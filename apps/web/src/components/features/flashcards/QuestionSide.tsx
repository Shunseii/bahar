import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import type { CardLayout } from "@bahar/drizzle-user-db-schemas";
import type { FC } from "react";
import { CardFace } from "./CardFace";

/**
 * This displays the front side of the flashcard which contains
 * the Arabic word and any other fields the user has configured
 * to be displayed.
 */
export const QuestionSide: FC<{
  currentCard: FlashcardWithDictionaryEntry;
  layoutOverride?: CardLayout | null;
}> = ({ currentCard, layoutOverride }) => (
  <CardFace
    currentCard={currentCard}
    face="forward_question"
    layoutOverride={layoutOverride}
  />
);
