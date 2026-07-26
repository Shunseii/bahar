DELETE FROM flashcards
WHERE direction = 'reverse'
  AND COALESCE((SELECT show_reverse_flashcards FROM settings LIMIT 1), 0) = 0;
