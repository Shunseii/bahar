import { defineCommand } from "@bunli/core";
import { applyAdds } from "../lib/apply-adds";
import { loadCredentials } from "../lib/credentials";
import { connectUserDb } from "../lib/db";
import { parseWordInput, type WordInput } from "../lib/word-input";

const printHelp = () => {
  console.log(`Add one or more words, each with its forward + reverse flashcards.

Usage:
  bahar add < words.json      Add words from a JSON array on stdin.
  bahar add help              Show this help.

Each word object accepts:
  word         (required) the Arabic word/expression
  translation  (required) the translation
  type         (required) one of: ism | fi'l | harf | expression
  definition   (optional) string
  root         (optional) array of root letters
  tags         (optional) array of strings
  antonyms     (optional) array of antonym objects
  examples     (optional) array of example objects
  morphology   (optional) morphology object

Example:
  echo '[{"word":"نور","translation":"light","type":"ism","tags":["nature"]}]' | bahar add

Each word is written with its flashcard pair in one atomic step, so an entry is
never created without its cards. Prefer this over hand-written SQL INSERTs, which
skip the flashcards and leave the word with no review schedule.`);
};

export const addCommand = defineCommand({
  name: "add",
  description: "Add one or more words with their flashcards (from stdin)",
  handler: async ({ positional, colors }) => {
    const args = positional as string[];

    if (args[0] === "help") {
      printHelp();
      return;
    }

    let items: WordInput[];
    try {
      const stdin = process.stdin.isTTY ? null : await Bun.stdin.text();
      items = parseWordInput(stdin);
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
      const { added } = await applyAdds({ db, items });

      console.log(
        JSON.stringify({ added: added.length, results: added }, null, 2)
      );
    } finally {
      client.close();
    }
  },
});
