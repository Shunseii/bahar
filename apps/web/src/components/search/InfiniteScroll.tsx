import { Trans, useLingui } from "@lingui/react/macro";
import { FC, useEffect, useState, useCallback, memo } from "react";
import { useDebounce, useMeasure, useWindowScroll } from "@uidotdev/usehooks";
import {
  Edit,
  BookOpenText,
  ChevronDown,
  Copy,
  Check,
  SearchX,
  Loader2,
} from "lucide-react";
import { Button } from "../ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useInfiniteScroll } from "@/hooks/useSearch";
import { useAtomValue } from "jotai";
import { searchQueryAtom } from "./state";
import { Highlight } from "./Highlight";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@bahar/design-system";
import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { useQuery } from "@tanstack/react-query";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";

const useWordTypeLabels = (): Record<SelectDictionaryEntry["type"], string> => {
  const { t } = useLingui();
  return {
    ism: t`Noun`,
    "fi'l": t`Verb`,
    harf: t`Particle`,
    expression: t`Expression`,
  };
};

const CopyButton: FC<{ text: string }> = memo(({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </Button>
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
    <div className="flex flex-col gap-3 pt-3 mt-3 border-t border-border/50">
      {/* Type and Root row */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
          {wordTypeLabels[document.type]}
        </span>
        {hasRoot && (
          <span
            dir="rtl"
            className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-arabic ltr:text-left"
          >
            {document.root!.join(" - ")}
          </span>
        )}
      </div>

      {/* Definition */}
      {hasDefinition && (
        <div>
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-1">
            <Trans>Definition</Trans>
          </p>
          <p className="text-sm text-foreground/80">{document.definition}</p>
        </div>
      )}

      {/* Loading state for heavy fields */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">
            <Trans>Loading details...</Trans>
          </span>
        </div>
      )}

      {/* Ism Morphology */}
      {ismMorphology && (
        <div>
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Morphology</Trans>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {ismMorphology.singular && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Singular</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {ismMorphology.singular}
                </p>
              </div>
            )}
            {ismMorphology.dual && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Dual</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {ismMorphology.dual}
                </p>
              </div>
            )}
            {ismMorphology.plurals && ismMorphology.plurals.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Plural</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {ismMorphology.plurals.map((p) => p.word).join("، ")}
                </p>
              </div>
            )}
            {ismMorphology.gender && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Gender</Trans>
                </p>
                <p className="text-foreground/80 capitalize">
                  {ismMorphology.gender}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verb Morphology */}
      {verbMorphology && (
        <div>
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Morphology</Trans>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
            {verbMorphology.past_tense && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Past</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {verbMorphology.past_tense}
                </p>
              </div>
            )}
            {verbMorphology.present_tense && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Present</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {verbMorphology.present_tense}
                </p>
              </div>
            )}
            {verbMorphology.imperative && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Imperative</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {verbMorphology.imperative}
                </p>
              </div>
            )}
            {verbMorphology.form && (
              <div>
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Form</Trans>
                </p>
                <p className="text-foreground/80">
                  {verbMorphology.form}
                  {verbMorphology.form_arabic && (
                    <span dir="rtl" className="font-arabic ltr:ml-1 rtl:mr-1">
                      ({verbMorphology.form_arabic})
                    </span>
                  )}
                </p>
              </div>
            )}
            {verbMorphology.masadir && verbMorphology.masadir.length > 0 && (
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground/70">
                  <Trans>Verbal nouns</Trans>
                </p>
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/80 ltr:text-left"
                >
                  {verbMorphology.masadir.map((m) => m.word).join("، ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Examples */}
      {hasExamples && (
        <div>
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Examples</Trans>
          </p>
          <div className="space-y-2">
            {fullEntry!.examples!.slice(0, 2).map((example, i) => (
              <div
                key={i}
                className="p-2 rounded-lg bg-muted/30 border border-border/30"
              >
                <p
                  dir="rtl"
                  className="font-arabic text-base text-foreground/90 ltr:text-left"
                >
                  {example.sentence}
                </p>
                {example.translation && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {example.translation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {hasTags && (
        <div>
          <p className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wide mb-2">
            <Trans>Tags</Trans>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {document.tags!.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

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
      <article
        className={cn(
          "group relative p-4 rounded-xl",
          "bg-gradient-to-br from-muted/30 to-muted/10",
          "hover:from-muted/50 hover:to-muted/30",
          "border border-transparent hover:border-border/50",
          "transition-colors duration-200 ease-out",
          "hover:shadow-md hover:shadow-black/5",
          isExpanded && "from-muted/50 to-muted/30 border-border/50",
        )}
      >
        <div className="flex flex-col gap-y-2">
          <div className="flex justify-between items-start">
            <h2
              dir="rtl"
              className="rtl:text-right text-3xl sm:text-3xl font-semibold text-foreground/90 group-hover:text-foreground transition-colors duration-200"
            >
              <Highlight text={document.word} />
            </h2>

            <div className="flex items-center gap-1">
              <CopyButton text={document.word} />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                onClick={handleEdit}
              >
                <Edit className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-primary/10"
                onClick={handleToggle}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </Button>
            </div>
          </div>

          <p
            dir="ltr"
            className="ltr:text-left rtl:text-right text-base sm:text-base text-muted-foreground group-hover:text-muted-foreground/80 transition-colors duration-200"
          >
            <Highlight text={document.translation} />
          </p>
        </div>

        {/* Expanded details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <ExpandedDetails id={hit.id!} document={document} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle accent line */}
        <div className="absolute ltr:left-0 rtl:right-0 top-1/2 -translate-y-1/2 w-1 h-0 group-hover:h-8 bg-gradient-to-b from-primary/60 to-primary/20 rounded-full transition-all duration-300 ease-out" />
      </article>
    );
  },
);

/**
 * The difference in the height of the infinite list and the
 * window's scroll position at which we kick off the next query
 * for the infinite list.
 *
 * This should be a value that "feels good."
 */
const PIXEL_HEIGHT_OFFSET = 800;

export const InfiniteScroll: FC = () => {
  const navigate = useNavigate();
  const searchQuery = useAtomValue(searchQueryAtom);
  const {
    results: { hits } = {},
    showMore,
    hasMore,
  } = useInfiniteScroll({ term: searchQuery });
  const [ref, { height }] = useMeasure();
  const [{ y }] = useWindowScroll();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleNavigateEdit = useCallback(
    (id: string) => {
      navigate({
        to: `/dictionary/edit/$wordId`,
        params: { wordId: id },
      });
    },
    [navigate],
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
  const showEmptyDictionary = !hits?.length && !hasSearchQuery;
  const debouncedShowEmptyDictionary = useDebounce(showEmptyDictionary, 150);

  if (!hits?.length) {
    if (hasSearchQuery) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <SearchX className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium mb-1">
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <BookOpenText className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium mb-1">
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
          <li key={hit.id}>
            <WordCardContent
              hit={
                hit as { id: string | null; document: SelectDictionaryEntry }
              }
              isExpanded={expandedIds.has(hit.id!)}
              onToggleExpanded={toggleExpanded}
              onNavigateEdit={handleNavigateEdit}
            />
          </li>
        ))}
      </ul>

      {/* Loading indicator for infinite scroll */}
      {hasMore && (
        <div className="flex justify-center py-6">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-primary/40"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 1, 0.4],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
