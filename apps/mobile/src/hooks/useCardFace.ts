import {
  type CardFace,
  type CardFieldId,
  type CardLayout,
  resolveCardFace,
} from "@bahar/drizzle-user-db-schemas";
import { useQuery } from "@tanstack/react-query";
import { settingsTable } from "@/lib/db/operations";

/**
 * The ordered fields to render for one card face, from the user's saved layout
 * and falling back to the defaults while they have not configured one.
 *
 * `layoutOverride` lets the settings preview render an unsaved draft through
 * the same components review uses.
 */
export const useCardFace = (
  face: CardFace,
  layoutOverride?: CardLayout | null
): CardFieldId[] => {
  const { data: flashcardSettings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  return resolveCardFace({
    layout: layoutOverride ?? flashcardSettings?.card_layout,
    face,
    showAntonyms: flashcardSettings?.show_antonyms_in_flashcard ?? undefined,
  });
};
