import { cn } from "@bahar/design-system";
import { useLingui } from "@lingui/react/macro";
import { useAtom } from "jotai";
import { Search } from "lucide-react";
import { type FC, useRef, useState } from "react";
import { Input } from "../ui/input";
import { searchQueryAtom } from "./state";

interface SearchInputProps {
  className?: string;
}

export const SearchInput: FC<SearchInputProps> = ({ className = "" }) => {
  const [searchQuery, setSearchQuery] = useAtom(searchQueryAtom);
  const { t } = useLingui();
  const [inputValue, setInputValue] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  const setQuery = (newQuery: string) => {
    setInputValue(newQuery);
    setSearchQuery(newQuery);
  };

  return (
    <form
      action=""
      className={cn("relative flex-1 md:grow-0", className)}
      noValidate
      onReset={(event) => {
        event.preventDefault();
        event.stopPropagation();

        setQuery("");

        if (inputRef.current) {
          inputRef.current.focus();
        }
      }}
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (inputRef.current) {
          inputRef.current.blur();
        }
      }}
      role="search"
    >
      <Search className="absolute top-2.5 h-4 w-4 text-muted-foreground ltr:left-2.5 rtl:right-2.5" />

      <Input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        autoFocus
        className="w-full rounded-lg bg-background md:w-[450px] lg:w-[450px] ltr:pl-8 rtl:pr-8"
        maxLength={512}
        onChange={(e) => {
          const newQuery = e.currentTarget.value;

          setQuery(newQuery);
        }}
        placeholder={t`Search...`}
        ref={inputRef}
        spellCheck={false}
        type="search"
        value={inputValue}
      />
    </form>
  );
};
