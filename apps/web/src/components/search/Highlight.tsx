import { highlightWithDiacritics } from "@/lib/search";
import { useAtomValue } from "jotai";
import { FC, useMemo, memo } from "react";
import { searchQueryAtom } from "./state";
import DOMPurify from "dompurify";

export const Highlight: FC<{ text: string }> = memo(({ text }) => {
  const searchTerm = useAtomValue(searchQueryAtom);

  const sanitizedHtml = useMemo(() => {
    const highlightedText = highlightWithDiacritics(text, searchTerm);
    return DOMPurify.sanitize(highlightedText);
  }, [text, searchTerm]);

  return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
});
