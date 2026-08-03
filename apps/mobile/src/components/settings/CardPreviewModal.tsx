import {
  type CardLayout,
  FlashcardState,
  type SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { createScheduler, toFsrsCard } from "@bahar/fsrs";
import { Trans } from "@lingui/react/macro";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Modal, Text, View } from "react-native";
import { FlashcardCard } from "@/components/flashcards/FlashcardCard";
import { GradeButtons } from "@/components/flashcards/GradeButtons";
import { Button } from "@/components/ui/button";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations";

/**
 * A flashcard shaped from a real entry purely for display, scheduled as a brand
 * new card. Every scheduling field holds a real value so the card can go through
 * FSRS like any other -- and no cast, so the compiler catches a missing column
 * rather than an invalid date surfacing at runtime. Nothing is written back.
 */
const toPreviewCard = ({
  entry,
  direction,
  now,
}: {
  entry: SelectDictionaryEntry;
  direction: "forward" | "reverse";
  now: Date;
}): FlashcardWithDictionaryEntry => ({
  id: `preview-${direction}`,
  dictionary_entry_id: entry.id,
  difficulty: 0,
  due: now.toISOString(),
  due_timestamp_ms: now.getTime(),
  elapsed_days: 0,
  lapses: 0,
  last_review: null,
  last_review_timestamp_ms: null,
  learning_steps: 0,
  reps: 0,
  scheduled_days: 0,
  stability: 0,
  state: FlashcardState.NEW,
  direction,
  is_hidden: false,
  dictionary_entry: entry,
});

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

  // Memoised so the card keeps one identity across renders, and its intervals
  // come from the card itself -- the same path review takes.
  const { previewCard, schedulingCards, now } = useMemo(() => {
    const reference = new Date();

    if (!(entry && direction)) {
      return { previewCard: null, schedulingCards: null, now: reference };
    }

    const card = toPreviewCard({ entry, direction, now: reference });

    return {
      previewCard: card,
      now: reference,
      schedulingCards: createScheduler().repeat(toFsrsCard(card), reference),
    };
  }, [entry, direction]);

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

            {showAnswer && schedulingCards ? (
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
