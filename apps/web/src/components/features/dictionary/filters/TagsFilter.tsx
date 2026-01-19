import { cn } from "@bahar/design-system";
import { Button } from "@bahar/web-ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@bahar/web-ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@bahar/web-ui/components/popover";
import { t } from "@lingui/core/macro";
import { Plural, Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useState } from "react";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";

export const TagsFilter = () => {
  const [open, setOpen] = useState(false);
  const { tags: filteredTags } = useSearch({
    from: "/_authorized-layout/_search-layout",
  });
  const navigate = useNavigate();
  const { data: tags } = useQuery({
    queryFn: () => dictionaryEntriesTable.tags.query(),
    queryKey: [...dictionaryEntriesTable.tags.cacheOptions.queryKey],
  });

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-max min-w-[200px] justify-between"
          role="combobox"
          variant="outline"
        >
          {filteredTags?.length ? (
            <Plural
              one="# tag selected"
              other="# tags selected"
              value={filteredTags.length}
            />
          ) : (
            <Trans>Filter by tags...</Trans>
          )}
          <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-max min-w-[200px] p-0">
        <Command>
          <CommandInput placeholder={t`Search tag...`} />

          <CommandList>
            <CommandEmpty>
              <Trans>No tags found.</Trans>
            </CommandEmpty>

            <CommandGroup>
              {tags?.map(({ tag }) => (
                <CommandItem
                  key={tag}
                  onSelect={() => {
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
                  value={tag}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      filteredTags?.includes(tag) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {tag}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
