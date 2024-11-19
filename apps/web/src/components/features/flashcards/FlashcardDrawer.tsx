import { Plural, Trans, t } from "@lingui/macro";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../ui/tooltip";
import { Button } from "../../ui/button";
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
import { getQueryKey } from "@trpc/react-query";
import { motion } from "framer-motion";
import { useDir } from "@/hooks/useDir";
import { Badge } from "../../ui/badge";
import { FilterSchema } from "api/schemas";
import { z } from "@/lib/zod";
import { QuestionSide } from "./QuestionSide";
import { AnswerSide } from "./AnswerSide";
import { ReverseAnswerSide } from "./ReverseAnswerSide";
import { ReverseQuestionSide } from "./ReverseQuestionSide";

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

export type Flashcard = RouterOutput["flashcard"]["today"]["flashcards"][0];

const TagBadgesList: FC<{
  currentCard: Flashcard;
}> = ({ currentCard }) => {
  return (
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
  );
};

export const FlashcardDrawer: FC<FlashcardDrawerProps> = ({
  children,
  filters = {},
}) => {
  const dir = useDir();
  const [showAnswer, setShowAnswer] = useState(false);
  const { data, status } = trpc.flashcard.today.useQuery({ filters });
  const { mutate: updateFlashcard } = trpc.flashcard.update.useMutation({
    onMutate: async (updatedCard) => {
      const todayQueryKey = getQueryKey(
        trpc.flashcard.today,
        { filters },
        "query"
      );

      await queryClient.cancelQueries({
        queryKey: todayQueryKey,
        exact: false,
      });

      queryClient.setQueryData(todayQueryKey, (old: typeof data) => ({
        flashcards:
          old?.flashcards?.filter(
            (card) =>
              card.card.id !== updatedCard.id ||
              card.reverse !== updatedCard.reverse
          ) ?? [],
      }));
    },

    onSettled: async () => {
      const todayQueryKey = getQueryKey(
        trpc.flashcard.today,
        undefined,
        "query"
      );
      const deckListQueryKey = getQueryKey(trpc.decks.list, undefined, "query");

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
    flashcards[0]
  );

  useEffect(() => {
    if (!flashcards?.length) {
      setCurrentCard(null);
    }

    setCurrentCard(flashcards[0]);
  }, [flashcards]);

  const f = useMemo(() => fsrs(), []);
  const now = new Date();

  const scheduling_cards = currentCard
    ? f.repeat(currentCard.flashcard, now)
    : undefined;
  const currentFlashcardIndex = flashcards.findIndex(
    (flashcard) => flashcard.card.id === currentCard?.card.id
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
      updateFlashcard({
        flashcard: newCard,
        id: newCard.id,
        reverse: currentCard.reverse,
      });

      if (currentFlashcardIndex === flashcards.length - 1) {
        setCurrentCard(null);
      }
    },
    [currentCard]
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

        {/* Card body */}
        {!currentCard ? undefined : (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-y-4 px-8">
            <TagBadgesList currentCard={currentCard} />

            {currentCard.reverse ? (
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
                        { locale: dir === "ltr" ? enUS : ar }
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
                        { locale: dir === "ltr" ? enUS : ar }
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
                        { locale: dir === "ltr" ? enUS : ar }
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
                        { locale: dir === "ltr" ? enUS : ar }
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
