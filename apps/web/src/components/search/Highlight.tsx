import { oramaMatchHighlighter } from "@/lib/search";
import { useAtomValue } from "jotai";
import { FC } from "react";
import { searchQueryAtom } from "./state";
import DOMPurify from "dompurify";

export const Highlight: FC<{ text: string }> = ({ text }) => {
  const searchTerm = useAtomValue(searchQueryAtom);

  const highlightedText = oramaMatchHighlighter.highlight(
    text,
    searchTerm,
  ).HTML;

  const sanitizedHtml = DOMPurify.sanitize(highlightedText);

  return <span dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
};
