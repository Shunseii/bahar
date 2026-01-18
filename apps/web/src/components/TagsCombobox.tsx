import { cn } from "@bahar/design-system";
import { useDebounce } from "@uidotdev/usehooks";
import { Check, ChevronDown, X } from "lucide-react";
import {
  type FC,
  type KeyboardEvent,
  type ReactNode,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export const TagPill: FC<{
  disabled?: boolean;
  onClick?: () => void;
  tagValue: string;
}> = ({ tagValue, disabled, onClick }) => {
  return (
    <button
      className="inline-flex max-w-[calc(100%-8px)] items-center gap-1.5 rounded border bg-transparent py-1 pr-1.5 pl-2.5 text-sm active:bg-muted/50"
      disabled={disabled}
      key={tagValue}
      onClick={(e) => {
        e.stopPropagation();
        // On touch devices (mobile), clicking anywhere on the pill removes it
        if (window.matchMedia("(pointer: coarse)").matches) {
          onClick?.();
        }
      }}
      type="button"
    >
      <span className="truncate">{tagValue}</span>
      <button
        className="size-4 shrink-0 cursor-pointer rounded-sm opacity-70 transition-opacity hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            onClick?.();
          }
        }}
        type="button"
      >
        <X className="size-3.5" />
      </button>
    </button>
  );
};

export interface TagsComboboxProps<T> {
  /** Selected tag values */
  value: string[];
  onValueChange: (value: string[]) => void;

  /** Query function to fetch options */
  queryFn: (search: string) => Promise<T[]>;

  /** Extract the string value from each option */
  getOptionValue: (option: T) => string;

  /** Extract display label (defaults to value) */
  getOptionLabel?: (option: T) => string;
  placeholder?: string;

  /** Allow creating new tags not in options */
  allowCreate?: boolean;

  /** Custom render for "create new" option */
  renderCreateOption?: (inputValue: string) => ReactNode;
  debounceMs?: number;
  disabled?: boolean;

  /** Class name for root element */
  className?: string;
}

export function TagsCombobox<T>({
  value,
  onValueChange,
  queryFn,
  getOptionValue,
  getOptionLabel,
  placeholder = "Search...",
  allowCreate = true,
  renderCreateOption,
  debounceMs = 500,
  disabled = false,
  className,
}: TagsComboboxProps<T>) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [options, setOptions] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedInputValue = useDebounce(inputValue, debounceMs);

  const isSearching = inputValue !== debouncedInputValue || isLoading;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const trimmedInput = inputValue.trim();
  const showCreateOption =
    allowCreate &&
    trimmedInput !== "" &&
    !options.some((o) => getOptionValue(o) === trimmedInput) &&
    !value.includes(trimmedInput);

  const totalOptions = options.length + (showCreateOption ? 1 : 0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const fetchOptions = async () => {
      try {
        const results = await queryFn(debouncedInputValue);
        if (!cancelled) {
          startTransition(() => {
            setOptions(results);
            setIsLoading(false);
          });
        }
      } catch (_error) {
        if (!cancelled) {
          startTransition(() => {
            setOptions([]);
            setIsLoading(false);
          });
        }
      }
    };

    fetchOptions();

    return () => {
      cancelled = true;
    };
  }, [debouncedInputValue, queryFn]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
        setInputValue("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlight when input changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [inputValue]);

  const selectOption = useCallback(
    (optionValue: string) => {
      if (value.includes(optionValue)) {
        onValueChange(value.filter((v) => v !== optionValue));
      } else {
        onValueChange([...value, optionValue]);
      }
      setInputValue("");
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [value, onValueChange]
  );

  const removeTag = useCallback(
    (tagValue: string) => {
      onValueChange(value.filter((v) => v !== tagValue));
      inputRef.current?.focus();
    },
    [value, onValueChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setIsOpen(true);
          setHighlightedIndex((prev) =>
            prev < totalOptions - 1 ? prev + 1 : prev
          );
          break;

        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case "Enter":
          event.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < totalOptions) {
            if (highlightedIndex < options.length) {
              selectOption(getOptionValue(options[highlightedIndex]));
            } else if (showCreateOption) {
              selectOption(trimmedInput);
            }
          } else if (showCreateOption && trimmedInput) {
            selectOption(trimmedInput);
          }
          break;

        case "Escape":
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;

        case "Backspace":
          if (inputValue === "" && value.length > 0) {
            removeTag(value[value.length - 1]);
          }
          break;
      }
    },
    [
      disabled,
      totalOptions,
      highlightedIndex,
      options,
      showCreateOption,
      trimmedInput,
      inputValue,
      selectOption,
      removeTag,
      value,
      getOptionValue,
    ]
  );

  const getLabel = (option: T) =>
    getOptionLabel ? getOptionLabel(option) : getOptionValue(option);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div
        className={cn(
          "relative flex min-h-10 w-full flex-row flex-wrap items-center gap-1.5 rounded-md border border-input bg-background py-2 text-sm shadow-xs",
          "focus-within:ring-1 focus-within:ring-ring",
          "ltr:pr-5 ltr:pl-2.5 rtl:pr-2.5 rtl:pl-5",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
          }
        }}
      >
        {value.map((tagValue) => (
          <TagPill
            disabled={disabled}
            key={tagValue}
            onClick={() => {
              removeTag(tagValue);
            }}
            tagValue={tagValue}
          />
        ))}

        <input
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className="h-fit flex-1 bg-transparent p-0 outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed"
          disabled={disabled}
          onBlur={(e) => {
            // Delay closing to allow clicks on dropdown options to register
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setTimeout(() => {
                setIsOpen(false);
                setHighlightedIndex(-1);
                setInputValue("");
              }, 150);
            }
          }}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={inputValue}
        />

        <button
          className="absolute top-[19px] -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground/80 ltr:right-2 rtl:left-2"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
            inputRef.current?.focus();
          }}
          tabIndex={-1}
          type="button"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      {/* Dropdown Content */}
      {isOpen && (totalOptions > 0 || isSearching) && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-[300px] overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {isSearching ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              Searching...
            </div>
          ) : (
            <div ref={listRef} role="listbox">
              {options.map((option, index) => {
                const optionValue = getOptionValue(option);
                const isHighlighted = index === highlightedIndex;
                const isSelected = value.includes(optionValue);

                return (
                  <div
                    aria-selected={isSelected}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden",
                      isHighlighted && "bg-accent text-accent-foreground"
                    )}
                    key={optionValue}
                    onClick={() => selectOption(optionValue)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectOption(optionValue);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    tabIndex={0}
                  >
                    {getLabel(option)}
                    {isSelected && (
                      <span className="absolute right-2 flex size-3.5 items-center justify-center">
                        <Check className="size-4" />
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Create new option */}
              {showCreateOption && (
                <div
                  className={cn(
                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden",
                    highlightedIndex === options.length &&
                      "bg-accent text-accent-foreground"
                  )}
                  onClick={() => selectOption(trimmedInput)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectOption(trimmedInput);
                    }
                  }}
                  onMouseEnter={() => setHighlightedIndex(options.length)}
                  role="option"
                  tabIndex={0}
                >
                  {renderCreateOption ? (
                    renderCreateOption(trimmedInput)
                  ) : (
                    <>Add "{trimmedInput}"</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
