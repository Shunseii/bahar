import { defineCommand } from "@bunli/core";
import { applyGrades } from "../lib/apply-grades";
import { loadCredentials } from "../lib/credentials";
import { connectUserDb } from "../lib/db";
import { GRADE_LABELS } from "../lib/grade";
import { type GradeItem, parseGradeInput } from "../lib/grade-input";
import { postRevlogsBatch } from "../lib/revlog";

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

However many cards are graded, this opens one connection, persists every
flashcard update in a single batch, advances the streak once, and posts all
review logs in one request. Find a card's id by querying the user's database
directly (see the bahar-data-access skill). Never hand-write FSRS fields —
always grade here.`);
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

    const { db, client } = await connectUserDb(credentials.token);

    try {
      const { results, missing, revlogEntries } = await applyGrades({
        db,
        items,
      });

      if (revlogEntries.length > 0) {
        // Fire-and-forget like the app — a failed revlog must not fail grades.
        await postRevlogsBatch({
          token: credentials.token,
          entries: revlogEntries,
        }).catch((err) => {
          console.warn(`Failed to post review logs: ${err}`);
        });
      }

      for (const id of missing) {
        console.warn(
          colors.yellow(`Skipped: no flashcard found with id "${id}".`)
        );
      }

      console.log(
        JSON.stringify(
          { graded: results.length, skipped: missing.length, results, missing },
          null,
          2
        )
      );

      if (missing.length > 0) {
        process.exitCode = 1;
      }
    } finally {
      client.close();
    }
  },
});
