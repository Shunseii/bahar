import { cn } from "@bahar/design-system";
import {
  TAG_MODES,
  type TagMode,
  WORD_TYPES,
  type WordType,
} from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bahar/web-ui/components/select";
import { Separator } from "@bahar/web-ui/components/separator";
import { Trans, useLingui } from "@lingui/react/macro";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useSessionStorage } from "@uidotdev/usehooks";
import {
  ArrowDownUp,
  BookType,
  ChevronDown,
  FunnelXIcon,
  Lock,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { TagsFilter } from "@/components/features/dictionary/filters/TagsFilter";
import { TagPill } from "@/components/TagsCombobox";
import { useDir } from "@/hooks/useDir";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { useUserPlan } from "@/hooks/useUserPlan";

type SortOption =
  | "relevance"
  | "updatedAt"
  | "createdAt"
  | "difficulty"
  | "lastReviewed";

const SortOptionLabel = ({ option }: { option: SortOption }) => {
  switch (option) {
    case "relevance":
      return <Trans>Relevance</Trans>;
    case "updatedAt":
      return <Trans>Recently updated</Trans>;
    case "createdAt":
      return <Trans>Recently added</Trans>;
    case "difficulty":
      return <Trans>Most difficult</Trans>;
    case "lastReviewed":
      return <Trans>Recently reviewed</Trans>;
  }
};

const sortOptions: SortOption[] = [
  "relevance",
  "updatedAt",
  "createdAt",
  "difficulty",
  "lastReviewed",
];

const PRO_ONLY_SORTS: SortOption[] = ["difficulty", "lastReviewed"];

const useWordTypeLabels = (): Record<WordType, string> => {
  const { t } = useLingui();
  return {
    ism: t`Ism`,
    "fi'l": t`Fi'l`,
    harf: t`Harf`,
    expression: t`Expression`,
  };
};

const useTagModeLabels = (): Record<TagMode, string> => {
  const { t } = useLingui();
  return {
    all: t`Match all`,
    any: t`Match any`,
  };
};

/**
 * `trailingAction` shares the filters toggle's row so callers can put an action
 * beside it instead of spending another row on it.
 */
export const DictionaryFilters = ({
  trailingAction,
}: {
  trailingAction?: ReactNode;
}) => {
  const navigate = useNavigate();
  const dir = useDir();
  const { formatNumber } = useFormatNumber();
  const { isFreeUser } = useUserPlan();
  const wordTypeLabels = useWordTypeLabels();
  const tagModeLabels = useTagModeLabels();
  const {
    tags: filteredTags,
    tagMode,
    types: filteredTypes,
    sort,
  } = useSearch({
    from: "/_authorized-layout/_search-layout",
  });
  const activeTagMode: TagMode = tagMode ?? "any";
  const isTagModeRelevant = (filteredTags?.length ?? 0) >= 2;
  const [isExpanded, setIsExpanded] = useSessionStorage(
    "isFiltersExpanded",
    !!(
      filteredTags?.length ||
      filteredTypes?.length ||
      (sort && sort !== "relevance")
    )
  );

  // tagMode is deliberately absent here: it modifies how the selected tags
  // combine rather than narrowing anything on its own, so counting it would
  // claim a filter is active when nothing has been filtered.
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filteredTags?.length) count += filteredTags.length;
    if (filteredTypes?.length) count += filteredTypes.length;
    if (sort && sort !== "relevance") count += 1;
    return count;
  }, [filteredTags, filteredTypes, sort]);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          className="h-9 w-max gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(!isExpanded)}
          size="sm"
          variant="ghost"
        >
          {isExpanded ? (
            <Trans>Hide filters</Trans>
          ) : (
            <Trans>Show filters</Trans>
          )}

          {hasActiveFilters && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs">
              {formatNumber(activeFilterCount)}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </Button>

        {trailingAction}
      </div>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-4 pt-1">
            <section className="flex flex-row items-center gap-x-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="font-medium text-sm">
                  <Trans>Filters</Trans>
                </span>
              </div>

              <Separator className="shrink bg-linear-to-r from-border/50 via-border to-border/50" />
            </section>

            <section className="flex flex-col gap-y-2">
              {/* On the label row, and only once a second tag makes the choice
                  meaningful -- below two tags "all" and "any" select the same
                  entries, so the control would be inert. Deliberately quieter
                  than the word-type pills: this modifies the filter below it
                  rather than being a filter value of its own. */}
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-muted-foreground text-sm">
                  <Trans>Tags</Trans>
                </p>

                {isTagModeRelevant && (
                  <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
                    {TAG_MODES.map((mode) => {
                      const isSelected = activeTagMode === mode;
                      return (
                        <button
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs transition-colors",
                            isSelected
                              ? "bg-background font-medium text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          key={mode}
                          onClick={() => {
                            navigate({
                              to: "/",
                              search: (prev) => ({
                                ...prev,
                                tagMode: mode === "any" ? undefined : mode,
                              }),
                            });
                          }}
                          type="button"
                        >
                          {tagModeLabels[mode]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <TagsFilter />

              {filteredTags?.length ? (
                <ul className="flex flex-wrap gap-2">
                  {filteredTags.map((tag) => (
                    <TagPill
                      key={tag}
                      onClick={() => {
                        const shouldRemove = filteredTags?.some(
                          (t) => t === tag
                        );

                        if (shouldRemove) {
                          const newTags = filteredTags?.filter(
                            (t) => t !== tag
                          );

                          navigate({
                            to: "/",
                            search: (prev) => ({
                              ...prev,
                              tags: newTags?.length ? newTags : undefined,
                            }),
                          });
                        } else {
                          navigate({
                            to: "/",
                            search: (prev) => ({
                              ...prev,
                              tags: [...(filteredTags ?? []), tag],
                            }),
                          });
                        }
                      }}
                      tagValue={tag}
                    />
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="flex flex-row items-center gap-x-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <BookType className="h-4 w-4" />
                <span className="whitespace-nowrap font-medium text-sm">
                  <Trans>Word types</Trans>
                </span>
              </div>

              <Separator className="shrink bg-linear-to-r from-border/50 via-border to-border/50" />
            </section>

            <section className="flex flex-wrap gap-2">
              {WORD_TYPES.map((type) => {
                const isSelected = filteredTypes?.includes(type) ?? false;
                return (
                  <button
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                      isSelected
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                    key={type}
                    onClick={() => {
                      const next = isSelected
                        ? filteredTypes?.filter((t) => t !== type)
                        : [...(filteredTypes ?? []), type];
                      navigate({
                        to: "/",
                        search: (prev) => ({
                          ...prev,
                          types: next?.length ? next : undefined,
                        }),
                      });
                    }}
                    type="button"
                  >
                    {wordTypeLabels[type]}
                  </button>
                );
              })}
            </section>

            <section className="flex flex-row items-center gap-x-4">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowDownUp className="h-4 w-4" />
                <span className="whitespace-nowrap font-medium text-sm">
                  <Trans>Sort by</Trans>
                </span>
              </div>

              <Separator className="shrink bg-linear-to-r from-border/50 via-border to-border/50" />
            </section>

            <section className="flex flex-col gap-y-2">
              <Select
                dir={dir}
                onValueChange={(value: SortOption) => {
                  navigate({
                    to: "/",
                    search: (prev) => ({
                      ...prev,
                      sort: value === "relevance" ? undefined : value,
                    }),
                  });
                }}
                value={sort ?? "relevance"}
              >
                <SelectTrigger className="w-max min-w-[200px] cursor-pointer gap-x-2 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    {sortOptions.map((option) => {
                      const isProOnly = PRO_ONLY_SORTS.includes(option);
                      const isDisabled = isProOnly && isFreeUser;

                      return (
                        <SelectItem
                          className={cn(
                            "cursor-pointer",
                            isDisabled && "opacity-50"
                          )}
                          disabled={isDisabled}
                          key={option}
                          value={option}
                        >
                          <span className="flex items-center gap-1.5">
                            <SortOptionLabel option={option} />
                            {isProOnly && isFreeUser && (
                              <Lock className="h-3 w-3" />
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </section>

            {hasActiveFilters && (
              <Button
                className="h-8 w-max px-2 text-muted-foreground hover:text-foreground"
                onClick={clearAllFilters}
                size="sm"
                variant="ghost"
              >
                <FunnelXIcon />

                <Trans>Clear all filters</Trans>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
