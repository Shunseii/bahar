import { Plural, Trans, t } from "@lingui/macro";
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
import { Badge } from "./ui/badge";
import { FilterSchema } from "api/schemas";
import { z } from "@/lib/zod";

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
  filters?: z.infer<typeof FilterSchema>;
}

export const FlashcardDrawer: FC<FlashcardDrawerProps> = ({
  children,
  filters = {},
}) => {
  const dir = useDir();
  const [showAnswer, setShowAnswer] = useState(false);
  const { data: flashcardSettings } = trpc.settings.get.useQuery();
  const { data, status } = trpc.flashcard.today.useQuery({ filters });
  const { mutate: updateFlashcard, status: updateFlashcardStatus } =
    trpc.flashcard.update.useMutation({
      onMutate: async (updatedCard) => {
        const todayQueryKey = getQueryKey(
          trpc.flashcard.today,
          { filters },
          "query",
        );

        await queryClient.cancelQueries({
          queryKey: todayQueryKey,
          exact: false,
        });

        queryClient.setQueryData(todayQueryKey, (old: typeof data) => ({
          flashcards:
            old?.flashcards?.filter(
              (card) => card.card.id !== updatedCard.id,
            ) ?? [],
        }));
      },

      onSettled: async () => {
        const todayQueryKey = getQueryKey(
          trpc.flashcard.today,
          undefined,
          "query",
        );
        const deckListQueryKey = getQueryKey(
          trpc.decks.list,
          undefined,
          "query",
        );

        await queryClient.invalidateQueries({
          queryKey: deckListQueryKey,
        });

        await queryClient.invalidateQueries({
          queryKey: todayQueryKey,
          exact: false,
        });
      },
    });

  const flashcards = data?.flashcards ?? [];

  const [currentCard, setCurrentCard] = useState<(typeof flashcards)[0] | null>(
    flashcards[0],
  );

  useEffect(() => {
    if (!flashcards?.length) {
      setCurrentCard(null);
    }

    setCurrentCard(flashcards[0]);
  }, [flashcards]);

  // Will get triggered after the current flashcard has been updated
  // i.e. graded and removed from the queue. This will reset the answer
  // AFTER the grading. This is not reliable and is used more as a catch-all
  // for other cases when a card is updated without grading.
  useEffect(() => {
    if (currentCard) {
      setShowAnswer(false);
    }
  }, [currentCard]);

  const f = useMemo(() => fsrs(), []);
  const now = new Date();

  const scheduling_cards = currentCard
    ? f.repeat(currentCard.flashcard, now)
    : undefined;
  const currentFlashcardIndex = flashcards.findIndex(
    (flashcard) => flashcard.card.id === currentCard?.card.id,
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
        id: currentCard.card.id,
        due: selectedCard.due.toISOString(),
        last_review: selectedCard?.last_review?.toISOString() ?? null,
        due_timestamp: dueTimestamp,
        last_review_timestamp: lastReviewTimestamp,
      };

      setShowAnswer(false);
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

  const isIsm = currentCard?.card.type === "ism";
  const firstPlural = currentCard?.card.morphology?.ism?.plurals?.[0]?.word;
  const singular = currentCard?.card.morphology?.ism?.singular;
  const hasPlurals = isIsm && !!firstPlural;
  const hasSingular = isIsm && !!singular;

  const isVerb = currentCard?.card.type === "fi'l";
  const pastTense = currentCard?.card.morphology?.verb?.past_tense;
  const presentTense = currentCard?.card.morphology?.verb?.present_tense;
  const firstMasdar = currentCard?.card.morphology?.verb?.masadir?.[0]?.word;
  const hasPastTense = isVerb && !!pastTense;
  const hasPresentTense = isVerb && !!presentTense;
  const hasMasdar = isVerb && !!firstMasdar;

  const hasAntonyms = !!currentCard?.card?.antonyms?.length;
  const showAntonyms = flashcardSettings?.show_antonyms_in_flashcard;

  const root = currentCard?.card.root;

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
            <ul className="flex flex-wrap gap-2">
              {!!currentCard.card.type && (
                <Badge variant="secondary" className="w-max">
                  {getTranslatedType(currentCard.card.type)}
                </Badge>
              )}
              {currentCard.card.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="w-max">
                  {tag}
                </Badge>
              ))}
            </ul>

            <p dir="rtl" className="rtl:text-right text-xl sm:text-2xl">
              {currentCard.card.word}
            </p>

            <div className="flex gap-x-2 items-center ltr:self-end rtl:self-start rtl:flex-row-reverse">
              {hasPlurals && (
                <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                  (ج) {firstPlural}
                </p>
              )}
              {hasSingular && (
                <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                  (م) {singular}
                </p>
              )}

              {hasMasdar && (
                <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                  {firstMasdar}
                </p>
              )}

              {hasPresentTense && (
                <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                  {presentTense}
                </p>
              )}

              {hasPastTense && (
                <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                  {pastTense}
                </p>
              )}
            </div>

            {isVerb && root && (
              <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                {root.join("-")}
              </p>
            )}

            {showAntonyms === "hint" && hasAntonyms && (
              <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                أضداد:{" "}
                {currentCard.card.antonyms
                  ?.map((antonym) => antonym.word)
                  .join(", ")}
              </p>
            )}

            {showAnswer && (
              <motion.span
                className="text-base sm:text-lg"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {!!currentCard.card.definition && (
                  <p dir="rtl">المعنى: {currentCard.card.definition}</p>
                )}

                {showAntonyms === "answer" && hasAntonyms && (
                  <p dir="rtl" className="rtl:text-right font-light sm:text-xl">
                    أضداد:{" "}
                    {currentCard.card.antonyms
                      ?.map((antonym) => antonym.word)
                      .join(", ")}
                  </p>
                )}

                <p dir="ltr">{currentCard.card.translation}</p>
              </motion.span>
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
