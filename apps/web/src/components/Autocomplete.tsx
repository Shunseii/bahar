import { cn } from "@bahar/design-system";
import { Input } from "@bahar/web-ui/components/input";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useClickAway, useDebounce } from "@uidotdev/usehooks";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";

interface AutocompleteProps {
  className?: string;
  filter?: string[];
  allowAdd?: boolean;
  onClick?: (value: string) => void;
}

export const Autocomplete: FC<AutocompleteProps> = ({
  className = "",
  filter = [],
  onClick,
  allowAdd = true,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useClickAway<HTMLInputElement>(() => setShowDropdown(false));
  const { t } = useLingui();
  const [inputValue, setInputValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debouncedInputValue = useDebounce(inputValue, 500);

  const { data, isFetching } = useQuery({
    queryFn: () => dictionaryEntriesTable.tags.query(debouncedInputValue),
    ...dictionaryEntriesTable.tags.cacheOptions,
    queryKey: ["turso.dictionaryEntries.tags.query", debouncedInputValue],
  });

  useEffect(() => {
    if (inputValue !== debouncedInputValue || isFetching) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [inputValue, debouncedInputValue, isFetching]);

  const tags =
    data
      ?.filter((item) => !filter?.includes(item.tag))
      ?.map((item) => item.tag) ?? [];

  const selectTag = useCallback(
    (value: string) => {
      setShowDropdown(false);
      setInputValue("");

      onClick?.(value);
    },
    [onClick]
  );

  const addedTagIsFiltered = tags.length === 0 && filter.includes(inputValue);

  return (
    <div className={cn("relative", className)}>
      <div
        className="relative"
        onBlur={(e) => {
          // If we click outside the dropdown or the input, close the dropdown
          const clickedDropdown =
            e.relatedTarget === dropdownRef.current ||
            dropdownRef.current?.contains(e.relatedTarget);
          const clickedInput =
            e.relatedTarget === inputRef.current ||
            inputRef.current?.contains(e.relatedTarget);

          if (!(clickedDropdown || clickedInput)) {
            setShowDropdown(false);
          }
        }}
        ref={ref}
      >
        <Input
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="rounded-lg bg-background"
          maxLength={512}
          onChange={(e) => {
            setInputValue(e.currentTarget.value);
          }}
          onFocus={() => {
            setShowDropdown(true);
          }}
          placeholder={t`Search for a tag...`}
          ref={inputRef}
          spellCheck={false}
          type="search"
          value={inputValue}
        />

        {showDropdown &&
          !addedTagIsFiltered &&
          (tags.length > 0 || (tags.length === 0 && allowAdd)) && (
            <div
              className="absolute top-12 right-0 left-0 max-h-[164px] overflow-y-auto rounded-lg border-2 border-border bg-background"
              ref={dropdownRef}
            >
              {(() => {
                if (isSearching) {
                  return (
                    <div className="px-3 py-1">
                      <Trans>Searching...</Trans>
                    </div>
                  );
                }
                if (tags.length > 0) {
                  return (
                    <ul>
                      {tags.map((item) => (
                        <li
                          className="cursor-pointer px-3 py-1 hover:bg-muted"
                          key={item}
                          onClick={() => {
                            selectTag(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              selectTag(item);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return undefined;
              })()}

              {!isSearching &&
                inputValue.length > 0 &&
                !tags.includes(inputValue) &&
                !filter.includes(inputValue) && (
                  <button
                    className="w-full px-3 py-1 hover:bg-muted ltr:text-left rtl:text-right"
                    onClick={() => {
                      selectTag(inputValue);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        selectTag(inputValue);
                      }
                    }}
                    type="button"
                  >
                    <Trans>Add tag {inputValue}</Trans>
                  </button>
                )}
            </div>
          )}
      </div>
    </div>
  );
};
