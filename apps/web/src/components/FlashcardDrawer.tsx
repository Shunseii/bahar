import { Plural, Trans } from "@lingui/macro";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";
import { Button } from "./ui/button";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale/ar";
import { enUS } from "date-fns/locale/en-US";
import { fsrs, Grade, Rating } from "ts-fsrs";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "./ui/drawer";
import {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/query";
import { getQueryKey } from "@trpc/react-query";
import { motion } from "framer-motion";
import { useDir } from "@/hooks/useDir";

export const FlashcardDrawer: FC<PropsWithChildren> = ({ children }) => {
  const dir = useDir();
  const [showAnswer, setShowAnswer] = useState(false);
  const { data, status } = trpc.flashcard.today.useQuery();
  const { mutate: updateFlashcard } = trpc.flashcard.update.useMutation({
    onSuccess: async () => {
      const queryKey = [
        ...getQueryKey(trpc.flashcard.today),
        { type: "query" },
      ];

      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const flashcards = data?.flashcards ?? [];

  const [currentCard, setCurrentCard] = useState<(typeof flashcards)[0] | null>(
    flashcards[0],
  );

  useEffect(() => {
    if (!flashcards?.length) return;

    setCurrentCard(flashcards[0]);
  }, [flashcards]);

  useEffect(() => {
    if (currentCard) {
      setShowAnswer(false);
    }
  }, [currentCard]);

  const f = useMemo(() => fsrs(), []);
  const now = new Date();

  const scheduling_cards = currentCard ? f.repeat(currentCard, now) : undefined;
  const currentFlashcardIndex = flashcards.findIndex(
    (flashcard) => flashcard.id === currentCard?.id,
  );

  const gradeCard = useCallback(
    (grade: Grade) => {
      if (!scheduling_cards || !currentCard) return;

      const selectedCard = scheduling_cards[grade].card;
      const dueTimestamp = Math.floor(selectedCard.due.getTime() / 1000);
      const lastReviewTimestamp = selectedCard?.last_review
        ? Math.floor(selectedCard.last_review.getTime() / 1000)
        : null;

      const newCard = {
        ...selectedCard,
        id: currentCard.id,
        content: currentCard.content,
        translation: currentCard.translation,
        due: selectedCard.due.toISOString(),
        last_review: selectedCard?.last_review?.toISOString() ?? null,
        due_timestamp: dueTimestamp,
        last_review_timestamp: lastReviewTimestamp,
      };

      updateFlashcard(newCard);

      if (currentFlashcardIndex === flashcards.length - 1) {
        setCurrentCard(null);
      }
    },
    [currentCard],
  );

  // Initial load
  if (status === "pending") {
    return null;
  }

  return (
    <Drawer
      onClose={() => {
        setShowAnswer(false);
      }}
    >
      {flashcards?.length ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DrawerTrigger asChild>{children}</DrawerTrigger>
          </TooltipTrigger>

          <TooltipContent>
            <Plural
              value={flashcards.length}
              one="You have # card to review."
              other="You have # cards to review"
            />
          </TooltipContent>
        </Tooltip>
      ) : (
        <DrawerTrigger asChild>{children}</DrawerTrigger>
      )}

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {flashcards?.length ? (
              <Plural
                value={flashcards.length}
                one="# card left to review"
                other="# cards left to review"
              />
            ) : (
              <Trans>You have no flashcards to review for now!</Trans>
            )}
          </DrawerTitle>
        </DrawerHeader>

        {!currentCard ? undefined : (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-y-4 px-8">
            <p dir="rtl" className="rtl:text-right text-xl sm:text-2xl">
              {currentCard.content}
            </p>

            {showAnswer && (
              <motion.p
                dir="ltr"
                className="ltr:text-left text-base sm:text-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {currentCard.translation}
              </motion.p>
            )}
          </div>
        )}

        <DrawerFooter>
          {(() => {
            if (scheduling_cards && showAnswer) {
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-x-6 items-center w-max m-auto"
                >
                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="ltr:text-sm rtl:text-base ltr:font-light rtl:font-normal">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Again].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      variant="outline"
                      onClick={() => gradeCard(Rating.Again)}
                      className="rtl:text-lg"
                    >
                      <Trans>Again</Trans>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="ltr:text-sm rtl:text-base ltr:font-light rtl:font-normal">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Hard].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      variant="destructive"
                      onClick={() => gradeCard(Rating.Hard)}
                      className="rtl:text-lg"
                    >
                      <Trans>Hard</Trans>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="ltr:text-sm rtl:text-base ltr:font-light rtl:font-normal">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Good].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      variant="secondary"
                      onClick={() => gradeCard(Rating.Good)}
                      className="rtl:text-lg"
                    >
                      <Trans>Good</Trans>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="ltr:text-sm rtl:text-base ltr:font-light rtl:font-normal">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Easy].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      className="bg-green-600 hover:bg-green-500/60 rtl text-lg"
                      onClick={() => gradeCard(Rating.Easy)}
                    >
                      <Trans>Easy</Trans>
                    </Button>
                  </div>
                </motion.div>
              );
            } else if (scheduling_cards) {
              return (
                <Button
                  className="w-full max-w-sm self-center rtl:text-lg"
                  onClick={() => setShowAnswer(true)}
                >
                  <Trans>Show answer</Trans>
                </Button>
              );
            } else {
              return null;
            }
          })()}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
