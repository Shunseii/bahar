import { defineCommand } from "@bunli/core";
import { loadCredentials } from "../lib/credentials";
import { gradeFlashcards } from "../lib/dictionary-api";
import { GRADE_LABELS } from "../lib/grade";
import { type GradeItem, parseGradeInput } from "../lib/grade-input";

const printHelp = () => {
  console.log(`Grade one or more flashcards, running the real FSRS scheduler.

Usage:
  bahar grade <id> <grade>            Grade a single card.
  bahar grade <id...> <grade>         Grade many cards with the same grade
                                      (the grade is always the last argument).
  bahar grade < cards.json            Grade with per-card grades from stdin,
                                      a JSON array: [{"id": "...", "grade": "..."}]
  bahar grade help                    Show this help.

  <grade>   one of: ${GRADE_LABELS}

However many cards are graded, this sends one request; the server runs FSRS,
persists every flashcard update in a single batch, advances the streak once, and
records all review logs. Find a card's id by querying the user's database
directly (see the bahar-data-access skill). Never hand-write FSRS fields --
always grade here; your database token can't write them anyway.`);
};

export const gradeCommand = defineCommand({
  name: "grade",
  description: "Grade one or more flashcards (from args or stdin)",
  handler: async ({ positional, colors }) => {
    const args = positional as string[];

    if (args[0] === "help") {
      printHelp();
      return;
    }

    let items: GradeItem[];
    try {
      const stdin = process.stdin.isTTY ? null : await Bun.stdin.text();
      items = parseGradeInput({ positional: args, stdin });
    } catch (error) {
      console.error(
        colors.red(error instanceof Error ? error.message : String(error))
      );
      process.exitCode = 1;
      return;
    }

    if (items.length === 0) {
      printHelp();
      return;
    }

    const credentials = await loadCredentials();
    if (!credentials) {
      console.error(colors.red("Not logged in. Run `bahar login` first."));
      process.exitCode = 1;
      return;
    }

    try {
      const { graded, missing } = await gradeFlashcards({
        token: credentials.token,
        grades: items,
      });

      for (const id of missing) {
        console.warn(
          colors.yellow(`Skipped: no flashcard found with id "${id}".`)
        );
      }

      console.log(
        JSON.stringify(
          {
            graded: graded.length,
            skipped: missing.length,
            results: graded,
            missing,
          },
          null,
          2
        )
      );

      if (missing.length > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(
        colors.red(error instanceof Error ? error.message : String(error))
      );
      process.exitCode = 1;
    }
  },
});
