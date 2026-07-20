-- Custom SQL migration file, put your code below! --

-- BAH-161: reverse flashcards move from a global gate to per-word row presence.
-- Users who currently have reverse turned OFF got a reverse row created eagerly
-- for every entry. Reverse existence is now opt-in per word and these were never
-- opted into, so delete every reverse row for OFF users -- including any with
-- study history. Deliberate: turning reverse OFF is treated as "I don't want
-- reverse," so we honor that and drop the old data outright rather than
-- resurfacing previously-studied reverse cards (which the new gate-less model
-- would otherwise auto-include in the queue). Users with reverse ON keep all
-- their reverse cards untouched.
--
-- Runs per user database and reads that database's own settings row. COALESCE
-- treats a missing settings row as OFF (the default), so those users' reverse
-- rows are removed too. Column name is the legacy `show_reverse_flashcards`
-- (repurposed in code to `create_reverse_by_default` via a Drizzle alias, not
-- renamed -- renaming a synced column silently reverts; see BAH-161).
DELETE FROM flashcards
WHERE direction = 'reverse'
  AND COALESCE((SELECT show_reverse_flashcards FROM settings LIMIT 1), 0) = 0;
