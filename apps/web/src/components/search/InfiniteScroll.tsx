import { cn } from "@bahar/design-system";
import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import { Card, CardContent } from "@bahar/web-ui/components/card";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useDebounce, useMeasure, useWindowScroll } from "@uidotdev/usehooks";
import { useAtomValue } from "jotai";
import {
  BookOpenText,
  Check,
  ChevronDown,
  Copy,
  Edit,
  Loader2,
  SearchX,
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
import { useInfiniteScroll } from "@/hooks/useSearch";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import { Highlight } from "./Highlight";
import { searchQueryAtom } from "./state";

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
      {/* Type and Root row */}
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

      {/* Definition */}
      {hasDefinition && (
        <div>
          <p className="mb-1 font-medium text-muted-foreground/70 text-xs uppercase tracking-wide">
            <Trans>Definition</Trans>
          </p>
          <p className="text-foreground/80 text-sm">{document.definition}</p>
        </div>
      )}

      {/* Loading state for heavy fields */}
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">
            <Trans>Loading details...</Trans>
          </span>
        </div>
      )}

      {/* Ism Morphology */}
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

      {/* Verb Morphology */}
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

      {/* Examples */}
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

      {/* Tags */}
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
            <h2
              className="font-semibold text-3xl transition-colors duration-200 sm:text-3xl rtl:text-right"
              dir="rtl"
            >
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

          <p className="text-muted-foreground" dir="ltr">
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
