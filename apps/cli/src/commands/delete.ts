import { dictionaryEntries } from "@bahar/drizzle-user-db-schemas";
import { defineCommand, option } from "@bunli/core";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { applyDeletes } from "../lib/apply-deletes";
import { loadCredentials } from "../lib/credentials";
import { connectUserDb } from "../lib/db";
import { parseDeleteInput } from "../lib/delete-input";

const printHelp = () => {
  console.log(`Delete one or more words and their flashcards.

Usage:
  bahar delete <id...> --yes       Delete the given entry ids.
  bahar delete --yes < ids.json    Delete ids from a JSON array on stdin
                                   (["id1", "id2"] or [{"id": "..."}]).
  bahar delete help                Show this help.

WARNING: this is destructive and irreversible. Deleting an entry also deletes
its flashcards and permanently loses their FSRS review history. There is no undo.

Without --yes, nothing is deleted -- the entries that would be deleted are
printed so you can confirm first.`);
};

export const deleteCommand = defineCommand({
  name: "delete",
  description: "Delete one or more words and their flashcards (destructive)",
  options: {
    yes: option(z.coerce.boolean().optional().default(false), {
      short: "y",
      description: "Confirm the deletion. Required to actually delete.",
    }),
  },
  handler: async ({ positional, flags, colors }) => {
    const args = positional as string[];

    if (args[0] === "help") {
      printHelp();
      return;
    }

    let ids: string[];
    try {
      const stdin = process.stdin.isTTY ? null : await Bun.stdin.text();
      ids = parseDeleteInput({ positional: args, stdin });
    } catch (error) {
      console.error(
        colors.red(error instanceof Error ? error.message : String(error))
      );
      process.exitCode = 1;
      return;
    }

    if (ids.length === 0) {
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
      if (!flags.yes) {
        // Dry run: show what would be deleted, delete nothing.
        const preview = await previewEntries({ db, ids });
        console.warn(
          colors.yellow(
            "Dry run -- nothing deleted. Re-run with --yes to confirm. This is irreversible."
          )
        );
        console.log(
          JSON.stringify(
            { wouldDelete: preview.found, notFound: preview.missing },
            null,
            2
          )
        );
        return;
      }

      const { deleted, missing } = await applyDeletes({ db, ids });

      for (const id of missing) {
        console.warn(colors.yellow(`Skipped: no entry found with id "${id}".`));
      }

      console.log(
        JSON.stringify(
          {
            deleted: deleted.length,
            skipped: missing.length,
            results: deleted,
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

/**
 * Looks up which ids exist (and their words) without deleting anything, for the
 * dry-run preview.
 */
const previewEntries = async ({
  db,
  ids,
}: {
  db: Awaited<ReturnType<typeof connectUserDb>>["db"];
  ids: string[];
}): Promise<{ found: { id: string; word: string }[]; missing: string[] }> => {
  const rows = await db
    .select({ id: dictionaryEntries.id, word: dictionaryEntries.word })
    .from(dictionaryEntries)
    .where(inArray(dictionaryEntries.id, ids));

  const foundIds = new Set(rows.map((r) => r.id));
  return {
    found: rows,
    missing: ids.filter((id) => !foundIds.has(id)),
  };
};
