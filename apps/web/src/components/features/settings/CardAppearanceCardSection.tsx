import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import {
  CARD_FACES,
  type CardFace,
  type CardFieldId,
  type CardLayout,
  FlashcardState,
  hiddenCardFields,
  REQUIRED_FIELD_BY_FACE,
  resolveCardFace,
  type SelectDictionaryEntry,
} from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Sentry from "@sentry/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Eye, EyeOff, Lock, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FlashcardDrawer } from "@/components/features/flashcards/FlashcardDrawer/FlashcardDrawer";
import { dictionaryEntriesTable, settingsTable } from "@/lib/db/operations";
import { queryClient } from "@/lib/query";

const FACE_LABELS: Record<CardFace, { direction: string; side: string }> = {
  forward_question: { direction: "forward", side: "question" },
  forward_answer: { direction: "forward", side: "answer" },
  reverse_question: { direction: "reverse", side: "question" },
  reverse_answer: { direction: "reverse", side: "answer" },
};

/**
 * A flashcard shaped from a real entry purely for previewing, scheduled as a
 * brand new card. The drawer runs it through FSRS to label its grade buttons,
 * so every scheduling field has to hold a real value -- an absent `due` reaches
 * `new Date(undefined)` and the interval formatting throws on the invalid date.
 * Nothing here is written back: the drawer's preview mode grades nothing.
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

export const CardAppearanceCardSection = () => {
  const { t } = useLingui();
  const [selectedFace, setSelectedFace] =
    useState<CardFace>("forward_question");
  const [draft, setDraft] = useState<Record<CardFace, CardFieldId[]> | null>(
    null
  );

  const { data: entries } = useQuery({
    queryFn: () => dictionaryEntriesTable.list.query({ limit: 1 }),
    ...dictionaryEntriesTable.list.cacheOptions,
  });

  const previewEntry = entries?.[0];

  // Memoised so the card keeps one identity: the drawer recomputes its FSRS
  // scheduling whenever the card object changes.
  const previewCards = useMemo(() => {
    if (!previewEntry) return null;

    const now = new Date();

    return {
      forward: toPreviewCard({
        entry: previewEntry,
        direction: "forward",
        now,
      }),
      reverse: toPreviewCard({
        entry: previewEntry,
        direction: "reverse",
        now,
      }),
    };
  }, [previewEntry]);

  const { data: settings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  const { mutateAsync: updateSettings, isPending } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
  });

  const fieldLabels: Record<CardFieldId, string> = {
    word: t`Word`,
    translation: t`Translation`,
    definition: t`Definition`,
    morphology: t`Morphology`,
    root: t`Root`,
    examples: t`Example`,
    antonyms: t`Antonyms`,
    tags: t`Tags`,
  };

  // The editor always works on all four faces so a save writes every one of
  // them, including the faces the user never opened.
  const faces =
    draft ??
    (Object.fromEntries(
      CARD_FACES.map((face) => [
        face,
        resolveCardFace({
          layout: settings?.card_layout,
          face,
          showAntonyms: settings?.show_antonyms_in_flashcard ?? undefined,
        }),
      ])
    ) as Record<CardFace, CardFieldId[]>);

  const layout: CardLayout = { version: 1, faces };
  const visible = faces[selectedFace];
  const hidden = hiddenCardFields(visible);
  const requiredField = REQUIRED_FIELD_BY_FACE[selectedFace];
  const isDirty = draft !== null;

  const setFace = (fields: CardFieldId[]) => {
    setDraft({ ...faces, [selectedFace]: fields });
  };

  const move = (index: number, offset: number) => {
    const next = [...visible];
    const target = index + offset;

    if (target < 0 || target >= next.length) return;

    [next[index], next[target]] = [next[target], next[index]];
    setFace(next);
  };

  const save = async () => {
    try {
      await updateSettings({ updates: { card_layout: layout } });
      setDraft(null);
      toast.success(t`Card layout saved.`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t`Could not save the card layout.`);
    }
  };

  const resetToDefaults = async () => {
    try {
      await updateSettings({ updates: { card_layout: null } });
      setDraft(null);
      toast.success(t`Card layout reset to the defaults.`);
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t`Could not reset the card layout.`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Card appearance</Trans>
        </CardTitle>
        <CardDescription>
          <Trans>
            Pick which fields show on each side of your cards, and in what
            order. Every entry makes a forward card and a reverse card, so there
            are four sides to set up.
          </Trans>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-y-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CARD_FACES.map((face) => {
            const { direction, side } = FACE_LABELS[face];
            const isSelected = face === selectedFace;

            return (
              <Button
                className="h-auto flex-col items-start gap-0.5 py-2"
                key={face}
                onClick={() => setSelectedFace(face)}
                type="button"
                variant={isSelected ? "default" : "outline"}
              >
                <span className="font-medium text-xs uppercase tracking-wide opacity-70">
                  {direction === "forward" ? (
                    <Trans>Forward</Trans>
                  ) : (
                    <Trans>Reverse</Trans>
                  )}
                </span>
                <span className="text-sm">
                  {side === "question" ? (
                    <Trans>Question side</Trans>
                  ) : (
                    <Trans>Answer side</Trans>
                  )}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="flex flex-col gap-y-2">
          {visible.map((field, index) => (
            <div
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
              key={field}
            >
              <div className="flex flex-col">
                <Button
                  aria-label={t`Move ${fieldLabels[field]} up`}
                  className="h-5 w-5"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  aria-label={t`Move ${fieldLabels[field]} down`}
                  className="h-5 w-5"
                  disabled={index === visible.length - 1}
                  onClick={() => move(index, 1)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              <span className="flex-1 text-sm">{fieldLabels[field]}</span>

              {field === requiredField ? (
                <span className="flex items-center gap-1 text-muted-foreground text-xs">
                  <Lock className="h-3 w-3" />
                  <Trans>Always shown</Trans>
                </span>
              ) : (
                <Button
                  aria-label={t`Hide ${fieldLabels[field]}`}
                  onClick={() =>
                    setFace(visible.filter((item) => item !== field))
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <EyeOff className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {hidden.length > 0 && (
          <div className="flex flex-col gap-y-2">
            <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              <Trans>Hidden on this side</Trans>
            </p>

            {hidden.map((field) => (
              <div
                className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2"
                key={field}
              >
                <span className="flex-1 text-muted-foreground text-sm">
                  {fieldLabels[field]}
                </span>
                <Button
                  aria-label={t`Show ${fieldLabels[field]}`}
                  onClick={() => setFace([...visible, field])}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!isDirty || isPending} onClick={save} type="button">
            <Trans>Save changes</Trans>
          </Button>
          <Button
            disabled={isPending}
            onClick={resetToDefaults}
            type="button"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            <Trans>Reset to defaults</Trans>
          </Button>

          <div className="flex flex-1 flex-wrap justify-end gap-2">
            {previewCards ? (
              <>
                <FlashcardDrawer
                  preview={{
                    card: previewCards.forward,
                    layoutOverride: layout,
                  }}
                >
                  <Button type="button" variant="outline">
                    <Trans>Preview forward card</Trans>
                  </Button>
                </FlashcardDrawer>
                <FlashcardDrawer
                  preview={{
                    card: previewCards.reverse,
                    layoutOverride: layout,
                  }}
                >
                  <Button type="button" variant="outline">
                    <Trans>Preview reverse card</Trans>
                  </Button>
                </FlashcardDrawer>
              </>
            ) : (
              <p className="text-muted-foreground text-xs">
                <Trans>Add a word to your dictionary to preview a card.</Trans>
              </p>
            )}
          </div>
        </div>

        {isDirty && (
          <p className="text-muted-foreground text-xs">
            <Trans>
              Unsaved changes. The preview already reflects them; your cards do
              not until you save.
            </Trans>
          </p>
        )}
      </CardContent>
    </Card>
  );
};
