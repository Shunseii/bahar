import { FlashcardWithDictionaryEntry } from "@/lib/db/operations/flashcards";
import { motion } from "motion/react";
import { FC } from "react";
import { Badge } from "../../../ui/badge";
import { t } from "@lingui/core/macro";
import { SelectDictionaryEntry } from "@bahar/drizzle-user-db-schemas";

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
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-wrap gap-2"
    >
      {!!currentCard.dictionary_entry.type && (
        <Badge
          variant="secondary"
          className="w-max bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 transition-colors"
        >
          {getTranslatedType(currentCard.dictionary_entry.type)}
        </Badge>
      )}
      {currentCard.dictionary_entry.tags?.map((tag, index) => (
        <motion.div
          key={tag}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 + index * 0.05 }}
        >
          <Badge
            variant="outline"
            className="w-max border-border/50 hover:border-border transition-colors"
          >
            {tag}
          </Badge>
        </motion.div>
      ))}
    </motion.ul>
  );
};
