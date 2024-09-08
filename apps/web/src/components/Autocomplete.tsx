import { useLingui } from "@lingui/react";
import { FC, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Trans, msg } from "@lingui/macro";
import { useClickAway, useDebounce } from "@uidotdev/usehooks";
import { Input } from "./ui/input";

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
  const { _ } = useLingui();
  const [inputValue, setInputValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debouncedInputValue = useDebounce(inputValue, 500);
  const { data, isFetching } = trpc.tags.search.useQuery({
    query: debouncedInputValue,
  });

  useEffect(() => {
    if (inputValue !== debouncedInputValue || isFetching) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [inputValue, debouncedInputValue, isFetching]);

  const tags =
    data?.facetHits
      ?.filter((item) => !filter?.includes(item.value))
      ?.map((item) => item.value) ?? [];

  const selectTag = useCallback(
    (value: string) => {
      setShowDropdown(false);
      setInputValue("");

      onClick?.(value);
    },
    [onClick],
  );

  const addedTagIsFiltered = tags.length === 0 && filter.includes(inputValue);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        className="relative"
        onBlur={(e) => {
          // If we click outside the dropdown or the input, close the dropdown
          const clickedDropdown =
            e.relatedTarget === dropdownRef.current ||
            dropdownRef.current?.contains(e.relatedTarget);
          const clickedInput =
            e.relatedTarget === inputRef.current ||
            inputRef.current?.contains(e.relatedTarget);

          if (!clickedDropdown && !clickedInput) {
            setShowDropdown(false);
          }
        }}
      >
        <Input
          type="search"
          placeholder={_(msg`Search for a tag...`)}
          className="rounded-lg bg-background"
          onFocus={() => {
            setShowDropdown(true);
          }}
          ref={inputRef}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={512}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.currentTarget.value);
          }}
        />

        {showDropdown &&
          inputValue.length > 0 &&
          !addedTagIsFiltered &&
          (tags.length > 0 || (tags.length === 0 && allowAdd)) && (
            <div
              ref={dropdownRef}
              className="absolute top-12 rounded-lg right-0 left-0 bg-background border-2 border-border"
            >
              {(() => {
                if (isSearching) {
                  return (
                    <div className="px-3 py-1">
                      <Trans>Searching...</Trans>
                    </div>
                  );
                } else if (tags.length > 0) {
                  return (
                    <ul>
                      {tags.map((item) => (
                        <li
                          className="cursor-pointer px-3 py-1 hover:bg-muted"
                          key={item}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              selectTag(item);
                            }
                          }}
                          onClick={() => {
                            selectTag(item);
                          }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                } else if (
                  inputValue.length > 0 &&
                  tags.length === 0 &&
                  !filter.includes(inputValue) &&
                  allowAdd
                ) {
                  return (
                    <button
                      className="px-3 py-1 hover:bg-muted w-full ltr:text-left rtl:text-right"
                      type="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          selectTag(inputValue);
                        }
                      }}
                      onClick={() => {
                        selectTag(inputValue);
                      }}
                    >
                      <Trans>Add tag {inputValue}</Trans>
                    </button>
                  );
                } else {
                  return undefined;
                }
              })()}
            </div>
          )}
      </div>
    </div>
  );
};
