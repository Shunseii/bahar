import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import type {
  CardFace,
  CardLayout,
  SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@bahar/web-ui/components/dialog";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { type FC, useEffect, useState } from "react";
import { Rating } from "ts-fsrs";
import { AnswerSide } from "@/components/features/flashcards/AnswerSide";
import { GradeOption } from "@/components/features/flashcards/FlashcardDrawer/GradeOption";
import { TagBadgesList } from "@/components/features/flashcards/FlashcardDrawer/TagBadgesList";
import { QuestionSide } from "@/components/features/flashcards/QuestionSide";
import { ReverseAnswerSide } from "@/components/features/flashcards/ReverseAnswerSide";
import { ReverseQuestionSide } from "@/components/features/flashcards/ReverseQuestionSide";
import { useCardFace } from "@/hooks/useCardFace";
import { dictionaryEntriesTable } from "@/lib/db/operations";

const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

/**
 * A flashcard shaped from a real entry purely for display. Scheduling fields
 * are never read by the card faces, and nothing here is written back.
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

export const CardPreviewDialog: FC<{
  direction: "forward" | "reverse" | null;
  layoutOverride?: CardLayout | null;
  onOpenChange: (open: boolean) => void;
}> = ({ direction, layoutOverride, onOpenChange }) => {
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setShowAnswer(false);
  }, [direction]);

  const { data: entries } = useQuery({
    queryFn: () => dictionaryEntriesTable.list.query({ limit: 1 }),
    ...dictionaryEntriesTable.list.cacheOptions,
  });

  const entry = entries?.[0];
  const face: CardFace = `${direction ?? "forward"}_${
    showAnswer ? "answer" : "question"
  }`;
  const showsTags = useCardFace(face, layoutOverride).includes("tags");

  const previewCard = entry
    ? toPreviewCard(entry, direction ?? "forward")
    : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={direction !== null}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {direction === "reverse" ? (
              <Trans>Reverse card preview</Trans>
            ) : (
              <Trans>Forward card preview</Trans>
            )}
          </DialogTitle>
          <DialogDescription>
            <Trans>
              The same view you get in review. Grading does nothing here.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        {previewCard ? (
          <div className="flex flex-col gap-y-4">
            {showsTags && <TagBadgesList currentCard={previewCard} />}

            <div className="relative rounded-2xl border border-border/50 bg-linear-to-br from-card to-card/50 p-4 shadow-lg sm:p-8">
              {direction === "reverse" ? (
                <>
                  <ReverseQuestionSide
                    currentCard={previewCard}
                    layoutOverride={layoutOverride}
                  />
                  <AnimatePresence>
                    {showAnswer && (
                      <motion.div
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 border-border/50 border-t pt-4"
                        exit={{ opacity: 0, height: 0 }}
                        initial={{ opacity: 0, height: 0 }}
                      >
                        <ReverseAnswerSide
                          currentCard={previewCard}
                          layoutOverride={layoutOverride}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  <QuestionSide
                    currentCard={previewCard}
                    layoutOverride={layoutOverride}
                  />
                  <AnimatePresence>
                    {showAnswer && (
                      <motion.div
                        animate={{ opacity: 1, height: "auto" }}
                        className="mt-4 border-border/50 border-t pt-4"
                        exit={{ opacity: 0, height: 0 }}
                        initial={{ opacity: 0, height: 0 }}
                      >
                        <AnswerSide
                          currentCard={previewCard}
                          layoutOverride={layoutOverride}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {showAnswer ? (
              <div className="grid grid-cols-4 gap-2">
                {GRADES.map((grade) => (
                  <GradeOption
                    grade={grade}
                    intervalLabel=""
                    key={grade}
                    onClick={() => {
                      // No-op: preview never schedules anything.
                    }}
                  />
                ))}
              </div>
            ) : (
              <Button onClick={() => setShowAnswer(true)} type="button">
                <Trans>Show answer</Trans>
              </Button>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            <Trans>Add a word to your dictionary to preview a card.</Trans>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
