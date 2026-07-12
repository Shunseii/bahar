import { defineCommand } from "@bunli/core";
import { applyEdits } from "../lib/apply-edits";
import { loadCredentials } from "../lib/credentials";
import { connectUserDb } from "../lib/db";
import { type EditItem, parseEditInput } from "../lib/edit-input";

const printHelp = () => {
  console.log(`Edit fields on one or more existing words.

Usage:
  bahar edit < edits.json     Edit words from a JSON array on stdin.
  bahar edit help             Show this help.

Each edit object needs an "id" plus any fields to change. Only the fields
present are updated; omit a field to leave it unchanged, or pass null to clear a
nullable field. Editable fields:
  word, translation, definition, type, root, tags, antonyms, examples, morphology

Example:
  echo '[{"id":"abc","translation":"light, glow","tags":["nature"]}]' | bahar edit

Every edit bumps the entry's updated_at so it syncs correctly. Ids with no
matching entry are reported and skipped. Prefer this over hand-written SQL, which
can forget the updated_at bump and lose the edit to a sync race.`);
};

export const editCommand = defineCommand({
  name: "edit",
  description: "Edit fields on one or more existing words (from stdin)",
  handler: async ({ positional, colors }) => {
    const args = positional as string[];

    if (args[0] === "help") {
      printHelp();
      return;
    }

    let items: EditItem[];
    try {
      const stdin = process.stdin.isTTY ? null : await Bun.stdin.text();
      items = parseEditInput(stdin);
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
      const { edited, missing } = await applyEdits({ db, items });

      for (const id of missing) {
        console.warn(colors.yellow(`Skipped: no entry found with id "${id}".`));
      }

      console.log(
        JSON.stringify(
          {
            edited: edited.length,
            skipped: missing.length,
            results: edited,
            missing,
          },
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
