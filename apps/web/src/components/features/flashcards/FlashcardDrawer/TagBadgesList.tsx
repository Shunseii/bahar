import type { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";
import { Badge } from "@bahar/web-ui/components/badge";
import { t } from "@lingui/core/macro";
import { motion } from "motion/react";
import type { FC } from "react";
import type { FlashcardWithDictionaryEntry } from "@/lib/db/operations/flashcards";

const getTranslatedType = (entryType: SelectDictionaryEntry["type"]) => {
  switch (entryType) {
    case "ism":
      return t`Noun`;
    case "fi'l":
      return t`Verb`;
    case "harf":
      return t`Preposition`;
    case "expression":
      return t`Expression`;
  }
};

export const TagBadgesList: FC<{
  currentCard: FlashcardWithDictionaryEntry;
}> = ({ currentCard }) => {
  return (
    <motion.ul
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2"
      initial={{ opacity: 0, y: -10 }}
      transition={{ delay: 0.1 }}
    >
      {!!currentCard.dictionary_entry.type && (
        <Badge
          className="w-max border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/15"
          variant="secondary"
        >
          {getTranslatedType(currentCard.dictionary_entry.type)}
        </Badge>
      )}
      {currentCard.dictionary_entry.tags?.map((tag, index) => (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.8 }}
          key={tag}
          transition={{ delay: 0.15 + index * 0.05 }}
        >
          <Badge
            className="w-max border-border/50 transition-colors hover:border-border"
            variant="outline"
          >
            {tag}
          </Badge>
        </motion.div>
      ))}
    </motion.ul>
  );
};
