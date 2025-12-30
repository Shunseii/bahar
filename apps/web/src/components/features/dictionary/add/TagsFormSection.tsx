import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useAtomValue } from "jotai";
import { useFieldArray, useFormContext } from "react-hook-form";
import { suggestedTagsAtom } from "@/atoms/suggested-tags";
import { TagsCombobox } from "@/components/TagsCombobox";
import { dictionaryEntriesTable } from "@/lib/db/operations/dictionary-entries";
import type { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

export const TagsFormSection = () => {
  const form = useFormContext<z.infer<typeof FormSchema>>();
  const suggestedTags = useAtomValue(suggestedTagsAtom);

  const { fields: tagFields, replace: replaceTags } = useFieldArray({
    name: "tags",
    control: form.control,
  });

  const selectedTags = tagFields.map((field) => field.name);

  const availableSuggestions = suggestedTags.filter(
    (tag) => !selectedTags.includes(tag)
  );

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      replaceTags([...tagFields, { name: tag }]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Tags</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>Add tags to your word.</Trans>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <TagsCombobox
          getOptionValue={(option) => option.tag}
          onValueChange={(value) => {
            replaceTags(value.map((item) => ({ name: item })));
          }}
          placeholder={t`Search for a tag...`}
          queryFn={dictionaryEntriesTable.tags.query}
          renderCreateOption={(value) => <Trans>Add tag {value}</Trans>}
          value={selectedTags}
        />

        {availableSuggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-sm">
              <Trans>Recently used</Trans>
            </p>

            <div className="flex flex-wrap gap-1.5">
              {availableSuggestions.map((tag) => (
                <button
                  className="cursor-pointer rounded-md border bg-secondary px-2.5 py-1 text-secondary-foreground text-sm transition-colors hover:bg-secondary/80"
                  key={tag}
                  onClick={() => addTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
