import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import type { CardLayout } from "@bahar/drizzle-user-db-schemas";
import type { FC } from "react";
import { CardFace } from "./CardFace";

/**
 * This displays the front side of the reverse flashcard which
 * contains the translation and any other fields the user has
 * been configured to be displayed.
 */
export const ReverseQuestionSide: FC<{
  currentCard: FlashcardWithDictionaryEntry;
  layoutOverride?: CardLayout | null;
}> = ({ currentCard, layoutOverride }) => (
  <CardFace
    currentCard={currentCard}
    face="reverse_question"
    layoutOverride={layoutOverride}
  />
);
