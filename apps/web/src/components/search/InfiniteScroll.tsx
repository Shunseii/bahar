import { cn } from "@bahar/design-system";
import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import { Card, CardContent } from "@bahar/web-ui/components/card";
import { plural, t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  useDebounce,
  useMeasure,
  useSet,
  useWindowScroll,
} from "@uidotdev/usehooks";
import {
  BookOpenText,
  Check,
  ChevronDown,
  Copy,
  Edit,
  Loader2,
  Lock,
  SearchX,
  Timer,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type FC,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { useInfiniteScroll } from "@/hooks/search/useSearch";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { intlFormatDistance } from "@/lib/date";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { flashcardsTable } from "@/lib/db/operations/flashcards";
import { settingsTable } from "@/lib/db/operations/settings";
import { Highlight } from "./Highlight";

const useWordTypeLabels = (): Record<SelectDictionaryEntry["type"], string> => {
  const { t } = useLingui();
  return {
    ism: t`Noun`,
    "fi'l": t`Verb`,
    harf: t`Particle`,
    expression: t`Expression`,
  };
};

const useGenderLabels = (): Record<"masculine" | "feminine", string> => {
  const { t } = useLingui();
  return {
    masculine: t`Masculine`,
    feminine: t`Feminine`,
  };
};

const SecondaryIconButton = ({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) => {
  return (
    <Button
      className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-foreground"
      onClick={onClick}
      size="icon"
      variant="ghost"
    >
      {children}
    </Button>
  );
};

const CopyButton: FC<{ text: string }> = memo(({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <SecondaryIconButton onClick={handleCopy}>
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </SecondaryIconButton>
  );
});

interface ExpandedDetailsProps {
  id: string;
  document: Pick<
    SelectDictionaryEntry,
    "type" | "root" | "tags" | "definition"
  >;
}

const ExpandedDetails: FC<ExpandedDetailsProps> = memo(({ id, document }) => {
  const wordTypeLabels = useWordTypeLabels();
  const genderLabels = useGenderLabels();

  const { data: fullEntry, isLoading } = useQuery({
    queryKey: [...dictionaryEntriesTable.entry.cacheOptions.queryKey, id],
    queryFn: () => dictionaryEntriesTable.entry.query(id),
  });

  const hasDefinition = document.definition;
  const hasRoot = document.root && document.root.length > 0;
  const hasTags = document.tags && document.tags.length > 0;
  const hasExamples = fullEntry?.examples && fullEntry.examples.length > 0;
  const hasMorphology = fullEntry?.morphology;

  const ismMorphology = hasMorphology ? fullEntry?.morphology?.ism : null;
  const verbMorphology = hasMorphology ? fullEntry?.morphology?.verb : null;

  return (
    <div className="mt-3 flex flex-col gap-3 border-border/50 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
          {wordTypeLabels[document.type]}
        </span>
        {hasRoot && (
          <span
            className="rounded-md bg-muted px-2 py-0.5 font-arabic text-muted-foreground ltr:text-left"
            dir="rtl"
          >
            {document.root!.join(" - ")}
          </span>
        )}
      </div>

      {hasDefinition && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Definition</Trans>
          </p>
          <p className="text-foreground/80 text-sm">{document.definition}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            <Trans>Loading details...</Trans>
          </span>
        </div>
      )}

      {ismMorphology && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Morphology</Trans>
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {ismMorphology.singular && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Singular</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {ismMorphology.singular}
                </p>
              </div>
            )}
            {ismMorphology.dual && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Dual</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {ismMorphology.dual}
                </p>
              </div>
            )}
            {ismMorphology.plurals && ismMorphology.plurals.length > 0 && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Plural</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {ismMorphology.plurals.map((p) => p.word).join("، ")}
                </p>
              </div>
            )}
            {ismMorphology.gender && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Gender</Trans>
                </p>
                <p className="text-foreground/80">
                  {genderLabels[ismMorphology.gender]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {verbMorphology && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Morphology</Trans>
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            {verbMorphology.past_tense && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Past</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {verbMorphology.past_tense}
                </p>
              </div>
            )}
            {verbMorphology.present_tense && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Present</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {verbMorphology.present_tense}
                </p>
              </div>
            )}
            {verbMorphology.imperative && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Imperative</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {verbMorphology.imperative}
                </p>
              </div>
            )}
            {verbMorphology.form && (
              <div>
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Form</Trans>
                </p>
                <p className="text-foreground/80">
                  {verbMorphology.form}
                  {verbMorphology.form_arabic && (
                    <span className="font-arabic ltr:ml-1 rtl:mr-1" dir="rtl">
                      ({verbMorphology.form_arabic})
                    </span>
                  )}
                </p>
              </div>
            )}
            {verbMorphology.masadir && verbMorphology.masadir.length > 0 && (
              <div className="col-span-2">
                <p className="text-muted-foreground/70 text-xs">
                  <Trans>Verbal nouns</Trans>
                </p>
                <p
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                  dir="rtl"
                >
                  {verbMorphology.masadir.map((m) => m.word).join("، ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {hasExamples && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Examples</Trans>
          </p>
          <div className="space-y-2">
            {fullEntry!.examples!.slice(0, 2).map((example, i) => (
              <div
                className="rounded-lg border border-border/30 bg-muted/30 p-2"
                key={i}
              >
                <p
                  className="font-arabic text-base text-foreground/90 ltr:text-left"
                  dir="rtl"
                >
                  {example.sentence}
                </p>
                {example.translation && (
                  <p className="mt-1 text-muted-foreground text-sm">
                    {example.translation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasTags && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Tags</Trans>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {document.tags!.map((tag) => (
              <span
                className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <ReviewHistory entryId={id} />
    </div>
  );
});

const RATING_DOT_STYLES: Record<string, string> = {
  again: "bg-muted-foreground",
  hard: "bg-orange-500",
  good: "bg-primary",
  easy: "bg-green-500",
};

const ReviewHistory: FC<{ entryId: string }> = memo(({ entryId }) => {
  const { i18n } = useLingui();
  const { data: userData } = authClient.useSession();
  const isProUser =
    userData?.user.plan === "pro" &&
    userData.user.subscriptionStatus !== "canceled";

  const { data: settingsData } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });
  const showReverse = settingsData?.show_reverse_flashcards ?? false;

  const { data: revlogData } = useQuery({
    queryFn: async () => {
      const { data, error } = await api.stats.revlogs.entry({ entryId }).get();
      if (error) throw error;
      return data;
    },
    queryKey: ["stats.revlogs.entry", entryId],
    enabled: isProUser,
  });

  const { data: flashcardData } = useQuery({
    queryFn: () => flashcardsTable.findByEntryId.query(entryId),
    queryKey: [...flashcardsTable.findByEntryId.cacheOptions.queryKey, entryId],
    enabled: isProUser,
  });

  if (!isProUser) {
    return (
      <div className="flex flex-col gap-1.5 border-border/50 border-t pt-3">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Review History</Trans>
          </p>
          <Lock className="h-3 w-3 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground text-xs">
          <Trans>
            Upgrade to Pro to see your review history for this word.
          </Trans>
        </p>
      </div>
    );
  }

  const revlogs = revlogData?.revlogs ?? [];
  const forwardRevlogs = revlogs.filter((r) => r.direction === "forward");
  const reverseRevlogs = revlogs.filter((r) => r.direction === "reverse");
  const forwardFlashcard = flashcardData?.find(
    (f) => f.direction === "forward"
  );
  const reverseFlashcard = flashcardData?.find(
    (f) => f.direction === "reverse"
  );

  const hasRevlogs = revlogs.length > 0;

  return (
    <div className="flex flex-col gap-3 border-border/50 border-t pt-3">
      <p className="font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
        <Trans>Review History</Trans>
      </p>

      {hasRevlogs ? (
        showReverse ? (
          <>
            <DirectionTimeline
              flashcard={forwardFlashcard}
              label={t`Arabic → English`}
              locale={i18n.locale}
              revlogs={forwardRevlogs}
            />
            <DirectionTimeline
              flashcard={reverseFlashcard}
              label={t`English → Arabic`}
              locale={i18n.locale}
              revlogs={reverseRevlogs}
            />
            <RatingLegend />
          </>
        ) : (
          <>
            <DirectionTimeline
              flashcard={forwardFlashcard}
              locale={i18n.locale}
              revlogs={forwardRevlogs}
            />
            <RatingLegend />
          </>
        )
      ) : undefined}

      <NextReviewSection
        forwardFlashcard={forwardFlashcard}
        locale={i18n.locale}
        reverseFlashcard={reverseFlashcard}
        showReverse={showReverse}
      />
    </div>
  );
});

const RatingLegend = () => (
  <div className="flex items-center gap-3">
    {Object.entries(RATING_DOT_STYLES).map(([rating, style]) => (
      <div className="flex items-center gap-1" key={rating}>
        <div className={cn("h-2.5 w-2.5 rounded-full", style)} />
        <span className="text-muted-foreground text-xs capitalize">
          {rating === "again"
            ? t`Again`
            : rating === "hard"
              ? t`Hard`
              : rating === "good"
                ? t`Good`
                : t`Easy`}
        </span>
      </div>
    ))}
  </div>
);

const formatNextReview = ({
  due,
  locale,
}: {
  due: string;
  locale: string;
}): { label: string; isOverdue: boolean } => {
  const dueDate = new Date(due);
  const now = new Date();
  const isOverdue = dueDate.getTime() <= now.getTime();

  if (isOverdue) {
    return { label: t`overdue`, isOverdue: true };
  }

  return {
    label: intlFormatDistance(dueDate, now, { locale }).label,
    isOverdue: false,
  };
};

const NextReviewSection: FC<{
  forwardFlashcard?: { due: string } | undefined;
  reverseFlashcard?: { due: string } | undefined;
  showReverse: boolean;
  locale: string;
}> = ({ forwardFlashcard, reverseFlashcard, showReverse, locale }) => {
  if (showReverse) {
    const forwardNext = forwardFlashcard
      ? formatNextReview({ due: forwardFlashcard.due, locale })
      : null;
    const reverseNext = reverseFlashcard
      ? formatNextReview({ due: reverseFlashcard.due, locale })
      : null;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            <Trans>Next Review</Trans>
          </span>
        </div>
        {forwardNext && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
            <span className="text-muted-foreground text-xs">
              <Trans>Arabic → English</Trans>
            </span>
            <span
              className={cn(
                "font-semibold text-xs",
                forwardNext.isOverdue ? "text-red-600" : "text-foreground"
              )}
            >
              {forwardNext.label}
            </span>
          </div>
        )}
        {reverseNext && (
          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5">
            <span className="text-muted-foreground text-xs">
              <Trans>English → Arabic</Trans>
            </span>
            <span
              className={cn(
                "font-semibold text-xs",
                reverseNext.isOverdue ? "text-red-600" : "text-foreground"
              )}
            >
              {reverseNext.label}
            </span>
          </div>
        )}
      </div>
    );
  }

  const flashcard = forwardFlashcard ?? reverseFlashcard;
  if (!flashcard) return null;

  const next = formatNextReview({ due: flashcard.due, locale });

  return (
    <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
      <div className="flex items-center gap-1.5">
        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground text-xs">
          <Trans>Next review</Trans>
        </span>
      </div>
      <span
        className={cn(
          "font-semibold text-xs",
          next.isOverdue ? "text-red-600" : "text-foreground"
        )}
      >
        {next.label}
      </span>
    </div>
  );
};

const MAX_VISIBLE_DOTS = 10;

const DirectionTimeline: FC<{
  revlogs: { rating: string | null; reviewTimestampMs: number }[];
  flashcard?: { due: string; lapses: number | null } | undefined;
  label?: string;
  locale: string;
}> = ({ revlogs, flashcard, label, locale }) => {
  const { formatNumber } = useFormatNumber();
  const reviewCount = revlogs.length;
  const lapseCount = flashcard?.lapses ?? 0;
  const lastReviewMs =
    revlogs.length > 0 ? revlogs[revlogs.length - 1].reviewTimestampMs : null;

  const metaParts: string[] = [];

  metaParts.push(
    plural(reviewCount, {
      one: `${formatNumber(reviewCount)} review`,
      other: `${formatNumber(reviewCount)} reviews`,
    })
  );
  metaParts.push(
    plural(lapseCount, {
      one: `${formatNumber(lapseCount)} lapse`,
      other: `${formatNumber(lapseCount)} lapses`,
    })
  );

  if (lastReviewMs) {
    metaParts.push(
      intlFormatDistance(new Date(lastReviewMs), new Date(), {
        style: "narrow",
        locale,
      }).label
    );
  }

  const showOldestLatest = reviewCount > 1;

  return (
    <div className="flex justify-between gap-1.5">
      {reviewCount > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {showOldestLatest && (
            <span className="text-muted-foreground/60 text-xs">
              <Trans>Oldest</Trans>
            </span>
          )}
          {revlogs.length > MAX_VISIBLE_DOTS && (
            <span className="text-muted-foreground text-xs">…</span>
          )}
          {(revlogs.length > MAX_VISIBLE_DOTS
            ? revlogs.slice(revlogs.length - MAX_VISIBLE_DOTS)
            : revlogs
          ).map((r, i) => (
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                RATING_DOT_STYLES[r.rating ?? "good"] ?? "bg-primary"
              )}
              key={i}
            />
          ))}
          {showOldestLatest && (
            <span className="text-muted-foreground/60 text-xs">
              <Trans>Latest</Trans>
            </span>
          )}
        </div>
      )}

      {(label || reviewCount > 0) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="font-semibold text-foreground text-xs">
              {label}
            </span>
          )}
          {reviewCount > 0 && (
            <span className="text-muted-foreground text-xs">
              {metaParts.join(" · ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

interface WordCardContentProps {
  hit: { id: string | null; document: SelectDictionaryEntry };
  isExpanded: boolean;
  onToggleExpanded: (id: string) => void;
  onNavigateEdit: (id: string) => void;
}

const WordCardContent: FC<WordCardContentProps> = memo(
  ({ hit, isExpanded, onToggleExpanded, onNavigateEdit }) => {
    const handleToggle = useCallback(() => {
      onToggleExpanded(hit.id!);
    }, [hit.id, onToggleExpanded]);

    const handleEdit = useCallback(() => {
      onNavigateEdit(hit.id!);
    }, [hit.id, onNavigateEdit]);
    const document = hit.document;

    return (
      <Card
        className={cn(
          "group relative rounded-xl pt-4",
          "border border-border",
          "transition-colors duration-200 ease-out",
          "hover:shadow-black/5 hover:shadow-md",
          isExpanded &&
            "from-muted/50 to-muted/30 dark:from-muted/60 dark:to-muted/40"
        )}
      >
        <CardContent className="flex flex-col gap-y-2">
          <div className="flex items-start justify-between">
            <h2 className="font-semibold text-3xl transition-colors duration-200 sm:text-3xl">
              <Highlight text={document.word} />
            </h2>

            <div className="flex items-center gap-1">
              <CopyButton text={document.word} />

              <SecondaryIconButton onClick={handleEdit}>
                <Edit className="h-4 w-4" />
              </SecondaryIconButton>

              <SecondaryIconButton onClick={handleToggle}>
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.div>
              </SecondaryIconButton>
            </div>
          </div>

          <p className="text-muted-foreground">
            <Highlight text={document.translation} />
          </p>

          {/* Expanded details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ExpandedDetails document={document} id={hit.id!} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle accent line */}
          <div className="absolute top-1/2 h-0 w-1 -translate-y-1/2 rounded-full bg-linear-to-b from-primary/60 to-primary/20 transition-all duration-300 ease-out group-hover:h-8 ltr:left-0 rtl:right-0" />
        </CardContent>
      </Card>
    );
  }
);

/**
 * The difference in the height of the infinite list and the
 * window's scroll position at which we kick off the next query
 * for the infinite list.
 *
 * This should be a value that "feels good."
 */
const PIXEL_HEIGHT_OFFSET = 800;

export const InfiniteScroll: FC<{ searchQuery?: string }> = ({
  searchQuery,
}) => {
  const { tags, sort } = useSearch({
    from: "/_authorized-layout/_search-layout",
  });
  const navigate = useNavigate();
  const {
    results: { hits } = {},
    showMore,
    hasMore,
  } = useInfiniteScroll({
    term: searchQuery,
    filters: { tags },
    sort,
  });
  const [ref, { height }] = useMeasure();
  const [{ y }] = useWindowScroll();
  const expandedIds = useSet<string>();

  const toggleExpanded = useCallback((id: string) => {
    if (expandedIds.has(id)) {
      expandedIds.delete(id);
    } else {
      expandedIds.add(id);
    }
  }, []);

  const handleNavigateEdit = useCallback(
    (id: string) => {
      navigate({
        to: "/dictionary/edit/$wordId",
        params: { wordId: id },
      });
    },
    [navigate]
  );

  const heightIsLoaded = height !== null && height > 0 && y !== null;
  const shouldLoadMore = heightIsLoaded
    ? height - y <= PIXEL_HEIGHT_OFFSET
    : false;

  useEffect(() => {
    if (shouldLoadMore && hasMore) {
      showMore();
    }
  }, [shouldLoadMore]);

  const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;
  const showEmptyDictionary = !(hits?.length || hasSearchQuery);
  const debouncedShowEmptyDictionary = useDebounce(showEmptyDictionary, 150);

  if (!hits?.length) {
    if (hasSearchQuery) {
      return (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
          initial={{ opacity: 0, y: 10 }}
        >
          <div className="mb-4 rounded-full bg-muted/50 p-4">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-1 font-medium text-lg">
            <Trans>No results found</Trans>
          </p>
          <p className="text-muted-foreground">
            <Trans>Try a different search term</Trans>
          </p>
        </motion.div>
      );
    }

    if (debouncedShowEmptyDictionary) {
      return (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
          initial={{ opacity: 0, y: 10 }}
        >
          <div className="mb-4 rounded-full bg-muted/50 p-4">
            <BookOpenText className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mb-1 font-medium text-lg">
            <Trans>You have no words in your dictionary yet.</Trans>
          </p>
          <p className="text-muted-foreground">
            <Trans>Add some to get started!</Trans>
          </p>
        </motion.div>
      );
    }

    return null;
  }

  return (
    <div>
      <ul className="flex flex-col gap-y-3" ref={ref}>
        {hits.map((hit) => (
          <li className="m-auto w-full max-w-3xl" key={hit.id}>
            <WordCardContent
              hit={
                hit as { id: string | null; document: SelectDictionaryEntry }
              }
              isExpanded={expandedIds.has(hit.id!)}
              onNavigateEdit={handleNavigateEdit}
              onToggleExpanded={toggleExpanded}
            />
          </li>
        ))}
      </ul>

      {hasMore && <LoadingIndicator />}
    </div>
  );
};

const LoadingIndicator = () => {
  return (
    <div className="flex justify-center py-6">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.4, 1, 0.4],
            }}
            className="h-2 w-2 rounded-full bg-primary/40"
            key={i}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
};
