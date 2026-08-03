import type { FlashcardWithDictionaryEntry } from "@bahar/db-operations";
import { cn } from "@bahar/design-system";
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
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Sentry from "@sentry/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, GripVertical, Lock, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FIELD_RENDERERS,
  PROMPT_CLASS_BY_FACE,
} from "@/components/features/flashcards/CardFace";
import { TagBadgesList } from "@/components/features/flashcards/FlashcardDrawer/TagBadgesList";
import { dictionaryEntriesTable, settingsTable } from "@/lib/db/operations";
import { queryClient } from "@/lib/query";

/**
 * A flashcard shaped from a real entry, scheduled as a brand new card. Field
 * renderers never read the scheduling columns, but they're filled in properly
 * so this stays a real flashcard rather than a cast.
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

const move = <T,>(items: T[], from: number, to: number): T[] => {
  const next = [...items];
  const [moved] = next.splice(from, 1);

  next.splice(to, 0, moved);

  return next;
};

/**
 * The card is the editor: fields render exactly as review renders them, and
 * clicking one hides it. Hidden fields stay in place, dimmed, so adding one back
 * is a click where it will appear rather than a hunt through a second list.
 */
export const CardAppearanceEditor = () => {
  const { i18n } = useLingui();
  const [direction, setDirection] = useState<"forward" | "reverse">("forward");
  const [side, setSide] = useState<"question" | "answer">("question");
  const [showHidden, setShowHidden] = useState(true);
  const [draggingField, setDraggingField] = useState<CardFieldId | null>(null);

  const face: CardFace = `${direction}_${side}`;

  const { data: settings } = useQuery({
    queryFn: () => settingsTable.getSettings.query(),
    ...settingsTable.getSettings.cacheOptions,
  });

  const { data: entries } = useQuery({
    queryFn: () => dictionaryEntriesTable.list.query({ limit: 1 }),
    ...dictionaryEntriesTable.list.cacheOptions,
  });

  const entry = entries?.[0];

  const previewCard = useMemo(
    () => (entry ? toPreviewCard({ entry, direction, now: new Date() }) : null),
    [entry, direction]
  );

  const { mutateAsync: updateSettings } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
  });

  const faces = Object.fromEntries(
    CARD_FACES.map((key) => [
      key,
      resolveCardFace({
        layout: settings?.card_layout,
        face: key,
        showAntonyms: settings?.show_antonyms_in_flashcard ?? undefined,
      }),
    ])
  ) as Record<CardFace, CardFieldId[]>;

  const visible = faces[face];
  const hidden = hiddenCardFields(visible);
  const requiredField = REQUIRED_FIELD_BY_FACE[face];

  const fieldLabels: Record<CardFieldId, string> = {
    tags: t`Tags`,
    word: t`Word`,
    translation: t`Translation`,
    definition: t`Definition`,
    type: t`Word type`,
    gender: t`Gender`,
    inflection: t`Inflection`,
    singular: t`Singular`,
    dual: t`Dual`,
    plurals: t`Plural`,
    past_tense: t`Past tense`,
    present_tense: t`Present tense`,
    imperative: t`Imperative`,
    active_participle: t`Active participle`,
    passive_participle: t`Passive participle`,
    masadir: t`Masdar`,
    verb_form: t`Verb form`,
    huroof: t`Huroof`,
    root: t`Root`,
    examples: t`Examples`,
    antonyms: t`Antonyms`,
  };

  // Writes land immediately -- there's no Save on this screen, so the card in
  // front of you is always the card review will show. The toast carries the
  // only escape hatch.
  const commit = async ({
    fields,
    undoLabel,
  }: {
    fields: CardFieldId[];
    undoLabel?: string;
  }) => {
    const previous = visible;
    const layout: CardLayout = {
      version: 1,
      faces: { ...faces, [face]: fields },
    };

    try {
      await updateSettings({ updates: { card_layout: layout } });

      if (undoLabel) {
        toast(undoLabel, {
          action: {
            label: i18n._(t`Undo`),
            onClick: () => commit({ fields: previous }),
          },
        });
      }
    } catch (error) {
      Sentry.captureException(error);
      toast.error(t`Could not update the card.`);
    }
  };

  const hide = (field: CardFieldId) =>
    commit({
      fields: visible.filter((item) => item !== field),
      undoLabel: t`${fieldLabels[field]} hidden`,
    });

  const show = (field: CardFieldId) =>
    commit({
      fields: [...visible, field],
      undoLabel: t`${fieldLabels[field]} shown`,
    });

  const drop = (target: CardFieldId) => {
    if (!draggingField || draggingField === target) return;

    const from = visible.indexOf(draggingField);
    const to = visible.indexOf(target);

    if (from === -1 || to === -1) return;

    commit({ fields: move(visible, from, to) });
    setDraggingField(null);
  };

  const rows: { field: CardFieldId; isVisible: boolean }[] = [
    ...visible.map((field) => ({ field, isVisible: true })),
    ...(showHidden ? hidden.map((field) => ({ field, isVisible: false })) : []),
  ];

  const segmented = <T extends string>({
    options,
    value,
    onChange,
  }: {
    options: { value: T; label: React.ReactNode }[];
    value: T;
    onChange: (next: T) => void;
  }) => (
    <div className="flex gap-0.5 rounded-lg bg-muted p-0.5">
      {options.map((option) => (
        <button
          className={cn(
            "rounded-md px-3.5 py-1.5 text-sm transition-colors",
            option.value === value
              ? "bg-background font-semibold shadow-sm"
              : "font-medium text-muted-foreground hover:text-foreground"
          )}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {segmented({
            value: direction,
            onChange: setDirection,
            options: [
              { value: "forward", label: <Trans>Forward</Trans> },
              { value: "reverse", label: <Trans>Reverse</Trans> },
            ],
          })}
          {segmented({
            value: side,
            onChange: setSide,
            options: [
              { value: "question", label: <Trans>Question</Trans> },
              { value: "answer", label: <Trans>Answer</Trans> },
            ],
          })}
        </div>

        <Button
          className="h-8 gap-1.5 rounded-full px-3 text-xs"
          onClick={() => setShowHidden(!showHidden)}
          size="sm"
          type="button"
          variant={showHidden ? "secondary" : "ghost"}
        >
          {showHidden ? (
            <>
              <Eye className="h-3.5 w-3.5" />
              <Trans>Showing hidden fields</Trans>
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              <Trans>Hidden fields off</Trans>
            </>
          )}
        </Button>
      </div>

      {previewCard ? (
        <div className="flex flex-col gap-y-2">
          {visible.includes("tags") && (
            <div className="flex items-center justify-between gap-3">
              <TagBadgesList currentCard={previewCard} />
              <button
                className="shrink-0 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => hide("tags")}
                title={t`Hide tags`}
                type="button"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-border/50 bg-linear-to-br from-card to-card/50 p-3 shadow-lg sm:p-4">
            {rows.map(({ field, isVisible }) => {
              const Field = FIELD_RENDERERS[field];
              const isRequired = field === requiredField;
              const isDragging = draggingField === field;

              return (
                <div
                  className={cn(
                    "group relative flex items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 transition-all",
                    isVisible
                      ? "hover:border-border hover:bg-muted/40"
                      : "border-border/70 border-dashed opacity-40 hover:opacity-70",
                    isDragging && "border-primary bg-primary/5 opacity-100"
                  )}
                  draggable={isVisible}
                  key={field}
                  onDragEnd={() => setDraggingField(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggingField(field)}
                  onDrop={() => drop(field)}
                >
                  <div className="flex w-4 shrink-0 justify-center">
                    {isVisible && (
                      <GripVertical
                        className={cn(
                          "h-4 w-4 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100",
                          isDragging && "opacity-100"
                        )}
                      />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <Field
                      currentCard={previewCard}
                      delay={0}
                      isPrompt={isRequired}
                      promptClassName={PROMPT_CLASS_BY_FACE[face]}
                    />
                    {field === "tags" ? null : (
                      <span className="pointer-events-none text-[10px] text-muted-foreground/50 uppercase tracking-wide opacity-0 transition-opacity group-hover:opacity-100">
                        {fieldLabels[field]}
                      </span>
                    )}
                  </div>

                  <div className="flex w-5 shrink-0 justify-center">
                    {isRequired ? (
                      <span title={t`Always shown on this side`}>
                        <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </span>
                    ) : (
                      <button
                        className="rounded-md p-1 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        onClick={() => (isVisible ? hide(field) : show(field))}
                        title={
                          isVisible
                            ? t`Hide ${fieldLabels[field]}`
                            : t`Show ${fieldLabels[field]}`
                        }
                        type="button"
                      >
                        {isVisible ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-muted-foreground/70 text-xs">
              <Trans>
                Click a field to hide it, drag to reorder. Changes apply
                straight away.
              </Trans>
            </p>
            <Button
              className="h-7 gap-1.5 px-2 text-muted-foreground text-xs"
              onClick={() =>
                commit({
                  fields: resolveCardFace({
                    layout: null,
                    face,
                    showAntonyms:
                      settings?.show_antonyms_in_flashcard ?? undefined,
                  }),
                  undoLabel: t`This side reset to defaults`,
                })
              }
              size="sm"
              type="button"
              variant="ghost"
            >
              <RotateCcw className="h-3 w-3" />
              <Trans>Reset this side</Trans>
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          <Trans>Add a word to your dictionary to set up your cards.</Trans>
        </p>
      )}
    </div>
  );
};
