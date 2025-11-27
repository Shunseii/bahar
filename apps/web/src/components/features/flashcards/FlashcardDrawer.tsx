import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { Button } from "../../ui/button";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale/ar";
import { enUS } from "date-fns/locale/en-US";
import { Card, fsrs, Grade, Rating } from "ts-fsrs";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "../../ui/drawer";
import {
  FC,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RouterOutput, trpc } from "@/lib/trpc";
import { queryClient } from "@/lib/query";
import { motion } from "motion/react";
import { useDir } from "@/hooks/useDir";
import { Badge } from "../../ui/badge";
import { QuestionSide } from "./QuestionSide";
import { AnswerSide } from "./AnswerSide";
import { ReverseAnswerSide } from "./ReverseAnswerSide";
import { ReverseQuestionSide } from "./ReverseQuestionSide";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  FLASHCARD_LIMIT,
  flashcardsTable,
  FlashcardWithDictionaryEntry,
} from "@/lib/db/operations/flashcards";
import {
  FlashcardState,
  SelectDeck,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";

const convertFlashcardToFsrsCard = (
  flashcard: SelectFlashcard,
): Card & { id: string } => {
  return {
    ...flashcard,
    due: new Date(flashcard.due),
    stability: flashcard.stability ?? 0,
    difficulty: flashcard.difficulty ?? 0,
    elapsed_days: flashcard.elapsed_days ?? 0,
    scheduled_days: flashcard.scheduled_days ?? 0,
    reps: flashcard.reps ?? 0,
    lapses: flashcard.lapses ?? 0,
    state: flashcard.state ?? FlashcardState.NEW,
    last_review: flashcard.last_review
      ? new Date(flashcard.last_review)
      : undefined,
  };
};

const getTranslatedType = (str: "ism" | "fi'l" | "harf" | "expression") => {
  switch (str) {
    case "ism":
      return t`Noun`;
    case "fi'l":
      return t`Verb`;
    case "harf":
      return t`Preposition`;
    case "expression":
      return t`Expression`;
  }
};

interface FlashcardDrawerProps extends PropsWithChildren {
  filters?: SelectDeck["filters"];
  show_reverse?: boolean;
}

export type Flashcard = RouterOutput["flashcard"]["today"]["flashcards"][0];

const TagBadgesList: FC<{
  currentCard: FlashcardWithDictionaryEntry;
}> = ({ currentCard }) => {
  return (
    <ul className="flex flex-wrap gap-2">
      {!!currentCard.dictionary_entry.type && (
        <Badge variant="secondary" className="w-max">
          {getTranslatedType(currentCard.dictionary_entry.type)}
        </Badge>
      )}
      {currentCard.dictionary_entry.tags?.map((tag) => (
        <Badge key={tag} variant="outline" className="w-max">
          {tag}
        </Badge>
      ))}
    </ul>
  );
};

export const FlashcardDrawer: FC<FlashcardDrawerProps> = ({
  children,
  filters = {},
  show_reverse = false,
}) => {
  const dir = useDir();
  const [showAnswer, setShowAnswer] = useState(false);
  const { data, status } = useQuery({
    queryFn: () =>
      flashcardsTable.today.query({ filters, showReverse: show_reverse }),
    ...flashcardsTable.today.cacheOptions,
    queryKey: [
      ...flashcardsTable.today.cacheOptions.queryKey,
      show_reverse,
      filters,
    ],
  });
  const { mutateAsync: updateFlashcard } = trpc.flashcard.update.useMutation({
    // TODO: Remove this with dual write logic
    // onMutate: async (updatedCard) => {
    //   const todayQueryKey = getQueryKey(
    //     trpc.flashcard.today,
    //     { filters, show_reverse },
    //     "query",
    //   );
    //
    //   await queryClient.cancelQueries({
    //     queryKey: todayQueryKey,
    //     exact: false,
    //   });
    //
    //   // TODO: when you have 101 cards, grading the next one will cause the
    //   // number to be off by one until the server response comes back.
    //   // This is due to the optimistic update.
    //
    //   queryClient.setQueryData(todayQueryKey, (old: typeof data) => ({
    //     total_hits: (old?.length ?? 0) - 1,
    //     flashcards:
    //       old?.filter(
    //         (card) =>
    //           card.id !== updatedCard.id ||
    //           (card.direction === "reverse") !== updatedCard.reverse,
    //       ) ?? [],
    //   }));
    // },
    // onSettled: async () => {
    //   const todayQueryKey = getQueryKey(
    //     trpc.flashcard.today,
    //     undefined,
    //     "query",
    //   );
    //   const deckListQueryKey = getQueryKey(trpc.decks.list, undefined, "query");
    //
    //   await queryClient.invalidateQueries({
    //     queryKey: deckListQueryKey,
    //   });
    //
    //   await queryClient.invalidateQueries({
    //     queryKey: todayQueryKey,
    //     exact: false,
    //   });
    // },
  });

  const { mutateAsync: updateFlashcardLocal } = useMutation({
    mutationFn: flashcardsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
    },
  });

  const flashcards = data ?? [];
  const totalHits = data?.length ?? 0;
  const hasMore = totalHits > FLASHCARD_LIMIT;

  const [currentCard, setCurrentCard] = useState<(typeof flashcards)[0] | null>(
    flashcards[0],
  );

  useEffect(() => {
    if (!flashcards?.length) {
      setCurrentCard(null);
    }

    setCurrentCard(flashcards[0]);
  }, [flashcards]);

  const f = useMemo(() => fsrs({ enable_fuzz: true }), []);
  const now = new Date();

  const scheduling_cards = currentCard
    ? f.repeat(convertFlashcardToFsrsCard(currentCard), now)
    : undefined;
  const currentFlashcardIndex = flashcards.findIndex(
    (flashcard) => flashcard.id === currentCard?.id,
  );

  const gradeCard = useCallback(
    async (grade: Grade) => {
      if (!scheduling_cards || !currentCard) return;

      const selectedCard = scheduling_cards[grade].card;
      const dueTimestamp = Math.floor(selectedCard.due.getTime() / 1000);
      const dueTimestampMs = selectedCard.due.getTime();
      const lastReviewTimestamp = selectedCard?.last_review
        ? Math.floor(selectedCard.last_review.getTime() / 1000)
        : null;
      const lastReviewTimestampMs = selectedCard?.last_review
        ? selectedCard.last_review.getTime()
        : null;

      const newCard = {
        ...selectedCard,
        id: currentCard.id,
        due: selectedCard.due.toISOString(),
        last_review: selectedCard?.last_review?.toISOString() ?? null,
        due_timestamp: dueTimestamp,
        last_review_timestamp: lastReviewTimestamp,
      };

      const localUpdates = {
        due: selectedCard.due.toISOString(),
        due_timestamp_ms: dueTimestampMs,
        last_review: selectedCard?.last_review?.toISOString() ?? null,
        last_review_timestamp_ms: lastReviewTimestampMs,
        state: selectedCard.state,
        stability: selectedCard.stability,
        difficulty: selectedCard.difficulty,
        reps: selectedCard.reps,
        lapses: selectedCard.lapses,
        elapsed_days: selectedCard.elapsed_days,
        scheduled_days: selectedCard.scheduled_days,
      };

      setShowAnswer(false);

      await Promise.all([
        updateFlashcard({
          flashcard: newCard,
          id: newCard.id,
          reverse: currentCard.direction === "reverse",
        }),
        updateFlashcardLocal({
          id: currentCard.id,
          updates: localUpdates,
        }),
      ]);

      if (currentFlashcardIndex === flashcards.length - 1) {
        setCurrentCard(null);
      }
    },
    [
      currentCard,
      scheduling_cards,
      currentFlashcardIndex,
      flashcards.length,
      updateFlashcard,
      updateFlashcardLocal,
    ],
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
            {hasMore ? (
              <Trans>
                You have more than {FLASHCARD_LIMIT} cards to review.
              </Trans>
            ) : (
              <Plural
                value={flashcards.length}
                one="You have # card to review."
                other="You have # cards to review"
              />
            )}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DrawerTrigger asChild>{children}</DrawerTrigger>
      )}

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {(() => {
              if (hasMore && flashcards?.length) {
                return (
                  <Trans>
                    You have more than {FLASHCARD_LIMIT} cards to review.
                  </Trans>
                );
              } else if (flashcards?.length) {
                return (
                  <Plural
                    value={flashcards.length}
                    one="# card left to review"
                    other="# cards left to review"
                  />
                );
              } else {
                return <Trans>You have no flashcards to review for now!</Trans>;
              }
            })()}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            <Trans>
              Review your Arabic flashcards and grade your understanding with
              Again, Hard, Good, or Easy options to adjust scheduling.
            </Trans>
          </DrawerDescription>
        </DrawerHeader>

        {/* Card body */}
        {!currentCard ? undefined : (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-y-4 px-8">
            <TagBadgesList currentCard={currentCard} />

            {currentCard.direction === "reverse" ? (
              <>
                <ReverseQuestionSide currentCard={currentCard} />

                {showAnswer && <ReverseAnswerSide currentCard={currentCard} />}
              </>
            ) : (
              <>
                <QuestionSide currentCard={currentCard} />

                {showAnswer && <AnswerSide currentCard={currentCard} />}
              </>
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
                  className="flex gap-x-6 items-end w-max m-auto"
                >
                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="max-w-14 text-center">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Again].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      variant="outline"
                      onClick={() => gradeCard(Rating.Again)}
                    >
                      <Trans>Again</Trans>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="max-w-14 text-center">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Hard].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      variant="destructive"
                      onClick={() => gradeCard(Rating.Hard)}
                    >
                      <Trans>Hard</Trans>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="max-w-14 text-center">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Good].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      variant="secondary"
                      onClick={() => gradeCard(Rating.Good)}
                    >
                      <Trans>Good</Trans>
                    </Button>
                  </div>

                  <div className="flex flex-col gap-y-2 items-center justify-center">
                    <p className="max-w-14 text-center">
                      {formatDistanceToNow(
                        scheduling_cards[Rating.Easy].card.due,
                        { locale: dir === "ltr" ? enUS : ar },
                      )}
                    </p>

                    <Button
                      className="bg-green-600 hover:bg-green-600/90 dark:hover:bg-green-500/60"
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
