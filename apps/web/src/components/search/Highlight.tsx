import { highlightWithDiacritics } from "@bahar/search";
import DOMPurify from "dompurify";
import { useAtomValue } from "jotai";
import { type FC, memo, useMemo } from "react";
import { searchQueryAtom } from "./state";

export const Highlight: FC<{ text: string }> = memo(({ text }) => {
  const searchTerm = useAtomValue(searchQueryAtom);

  const sanitizedHtml = useMemo(() => {
    const highlightedText = highlightWithDiacritics(text, searchTerm);
    return DOMPurify.sanitize(highlightedText);
  }, [text, searchTerm]);

  return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
});
