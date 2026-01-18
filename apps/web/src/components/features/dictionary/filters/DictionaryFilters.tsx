import { Button } from "@bahar/web-ui/components/button";
import { Trans } from "@lingui/react/macro";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { SlidersHorizontal } from "lucide-react";
import { TagsFilter } from "@/components/features/dictionary/filters/TagsFilter";

export const DictionaryFilters = () => {
  const navigate = useNavigate();
  const { tags: filteredTags } = useSearch({
    from: "/_authorized-layout/_search-layout",
  });

  const hasActiveFilters = !!filteredTags?.length && filteredTags.length > 0;

  const clearAllFilters = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="font-medium text-sm">
            <Trans>Filters</Trans>
          </span>
        </div>

        <TagsFilter />

        {hasActiveFilters && (
          <Button
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
            size="sm"
            variant="ghost"
          >
            <Trans>Clear all</Trans>
          </Button>
        )}
      </div>
    </div>
  );
};
