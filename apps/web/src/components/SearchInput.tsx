import { Search } from "lucide-react";
import { Input } from "./ui/input";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { UseSearchBoxProps, useSearchBox } from "react-instantsearch";
import { FC, useRef, useState } from "react";

export const SearchInput: FC<UseSearchBoxProps> = (props) => {
  const { _ } = useLingui();
  const { query, refine } = useSearchBox(props);
  const [inputValue, setInputValue] = useState(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const setQuery = (newQuery: string) => {
    setInputValue(newQuery);
    refine(newQuery);
  };

  return (
    <form
      className="relative ml-auto flex-1 md:grow-0"
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
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />

      <Input
        type="search"
        placeholder={_(msg`Search...`)}
        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
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
