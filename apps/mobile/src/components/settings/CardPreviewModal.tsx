import type {
  CardLayout,
  SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { createScheduler } from "@bahar/fsrs";
import { Trans } from "@lingui/react/macro";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Modal, Text, View } from "react-native";
import { createEmptyCard } from "ts-fsrs";
import { FlashcardCard } from "@/components/flashcards/FlashcardCard";
import { GradeButtons } from "@/components/flashcards/GradeButtons";
import { Button } from "@/components/ui/button";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations";

/**
 * A flashcard shaped from a real entry purely for display. Scheduling fields
 * are never read by the card, and nothing here is written back.
 */
const toPreviewCard = (
  entry: SelectDictionaryEntry,
  direction: "forward" | "reverse"
): FlashcardWithDictionaryEntry =>
  ({
    id: `preview-${direction}`,
    dictionary_entry_id: entry.id,
    direction,
    dictionary_entry: entry,
  }) as FlashcardWithDictionaryEntry;

/**
 * The review screen's card, driven by the layout being edited. Grading is
 * inert: the buttons appear once the answer is shown, as in review, but do not
 * schedule anything.
 */
export const CardPreviewModal: React.FC<{
  direction: "forward" | "reverse" | null;
  entry: SelectDictionaryEntry | null;
  layoutOverride?: CardLayout | null;
  onClose: () => void;
}> = ({ direction, entry, layoutOverride, onClose }) => {
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setShowAnswer(false);
  }, [direction]);

  const previewCard =
    entry && direction ? toPreviewCard(entry, direction) : null;

  // Interval labels come from a fresh card so the buttons read like a new card
  // in review, without the preview touching real scheduling state.
  const { schedulingCards, now } = useMemo(() => {
    const reference = new Date();

    return {
      now: reference,
      schedulingCards: createScheduler().repeat(
        createEmptyCard(reference),
        reference
      ),
    };
  }, []);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={direction !== null}
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-border/50 border-b px-4 py-3">
          <Text className="font-semibold text-base text-foreground">
            {direction === "reverse" ? (
              <Trans>Reverse card preview</Trans>
            ) : (
              <Trans>Forward card preview</Trans>
            )}
          </Text>
          <Button onPress={onClose} variant="ghost">
            <Text className="text-muted-foreground">
              <Trans>Close</Trans>
            </Text>
          </Button>
        </View>

        {previewCard ? (
          <View className="flex-1 justify-between gap-4 p-4">
            <View className="flex-1 justify-center">
              <FlashcardCard
                flashcard={previewCard}
                layoutOverride={layoutOverride}
                onFlip={() => setShowAnswer((shown) => !shown)}
                showAnswer={showAnswer}
              />
            </View>

            {showAnswer ? (
              <GradeButtons
                now={now}
                onGrade={() => {
                  // No-op: preview never schedules anything.
                }}
                schedulingCards={schedulingCards}
              />
            ) : (
              <Button onPress={() => setShowAnswer(true)}>
                <Text className="font-medium text-primary-foreground">
                  <Trans>Show answer</Trans>
                </Text>
              </Button>
            )}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-center text-muted-foreground text-sm">
              <Trans>Add a word to your dictionary to preview a card.</Trans>
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
};
