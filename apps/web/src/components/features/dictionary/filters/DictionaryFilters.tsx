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
import { Trans } from "@lingui/react/macro";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  ArrowDownUp,
  ChevronUp,
  FunnelXIcon,
  SlidersHorizontal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { TagsFilter } from "@/components/features/dictionary/filters/TagsFilter";
import { TagPill } from "@/components/TagsCombobox";
import { useDir } from "@/hooks/useDir";

type SortOption = "relevance" | "updatedAt" | "createdAt";

const SortOptionLabel = ({ option }: { option: SortOption }) => {
  switch (option) {
    case "relevance":
      return <Trans>Relevance</Trans>;
    case "updatedAt":
      return <Trans>Recently updated</Trans>;
    case "createdAt":
      return <Trans>Recently added</Trans>;
  }
};

const sortOptions: SortOption[] = ["relevance", "updatedAt", "createdAt"];

export const DictionaryFilters = () => {
  const navigate = useNavigate();
  const dir = useDir();
  const { tags: filteredTags, sort } = useSearch({
    from: "/_authorized-layout/_search-layout",
  });
  const [isExpanded, setIsExpanded] = useState(
    () => !!(filteredTags?.length || (sort && sort !== "relevance"))
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filteredTags?.length) count += filteredTags.length;
    if (sort && sort !== "relevance") count += 1;
    return count;
  }, [filteredTags, sort]);

  const hasActiveFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    navigate({ to: "/" });
  };

  if (!isExpanded) {
    return (
      <Button
        className="h-9 w-max gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => setIsExpanded(true)}
        size="sm"
        variant="outline"
      >
        <SlidersHorizontal className="h-4 w-4" />
        <Trans>Show filters</Trans>
        {hasActiveFilters && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs">
            {activeFilterCount}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4">
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
          <p className="font-medium text-muted-foreground text-sm">
            <Trans>Tags</Trans>
          </p>

          <TagsFilter />

          {filteredTags?.length ? (
            <ul className="flex flex-wrap gap-2">
              {filteredTags.map((tag) => (
                <TagPill
                  key={tag}
                  onClick={() => {
                    const shouldRemove = filteredTags?.some((t) => t === tag);

                    if (shouldRemove) {
                      const newTags = filteredTags?.filter((t) => t !== tag);

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
            <SelectTrigger className="w-max min-w-[200px] gap-x-2">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectGroup>
                {sortOptions.map((option) => (
                  <SelectItem
                    className="cursor-pointer"
                    key={option}
                    value={option}
                  >
                    <SortOptionLabel option={option} />
                  </SelectItem>
                ))}
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

        <Button
          className="h-8 w-max px-2 text-muted-foreground hover:text-foreground"
          onClick={() => setIsExpanded(false)}
          size="sm"
          variant="ghost"
        >
          <ChevronUp className="h-4 w-4" />
          <Trans>Hide filters</Trans>
        </Button>
      </div>
    </div>
  );
};
