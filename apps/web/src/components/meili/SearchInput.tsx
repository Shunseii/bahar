import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { useLingui } from "@lingui/react/macro";
import { UseSearchBoxProps, useSearchBox } from "react-instantsearch";
import { FC, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends UseSearchBoxProps {
  className?: string;
}

export const SearchInput: FC<SearchInputProps> = ({
  className = "",
  ...props
}) => {
  const { t } = useLingui();
  const { query, refine } = useSearchBox(props);
  const [inputValue, setInputValue] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const setQuery = (newQuery: string) => {
    setInputValue(newQuery);
    refine(newQuery);
  };

  return (
    <form
      className={cn("relative flex-1 md:grow-0", className)}
      role="search"
      noValidate
      action=""
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (inputRef.current) {
          inputRef.current.blur();
        }
      }}
      onReset={(event) => {
        event.preventDefault();
        event.stopPropagation();

        setQuery("");

        if (inputRef.current) {
          inputRef.current.focus();
        }
      }}
    >
      <Search className="absolute ltr:left-2.5 rtl:right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

      <Input
        type="search"
        placeholder={t`Search...`}
        className="w-full rounded-lg bg-background ltr:pl-8 rtl:pr-8 md:w-[450px] lg:w-[450px]"
        ref={inputRef}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={512}
        autoFocus
        value={inputValue}
        onChange={(e) => {
          const newQuery = e.currentTarget.value;

          setQuery(newQuery);
        }}
      />
    </form>
  );
};
