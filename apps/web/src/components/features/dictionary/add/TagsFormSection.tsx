import { Trans } from "@lingui/react/macro";
import { Autocomplete } from "@/components/Autocomplete";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { z } from "@/lib/zod";
import { FormSchema } from "@/schemas/dictionary";
import { X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

export const TagsFormSection = () => {
  const form = useFormContext<z.infer<typeof FormSchema>>();

  const {
    fields: tagFields,
    append: appendTag,
    remove: removeTag,
  } = useFieldArray({
    name: "tags",
    control: form.control,
  });

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

      <CardContent>
        <ul className="flex flex-wrap gap-2 mb-2">
          {tagFields.map((field, index) => {
            return (
              <Badge
                key={field.id}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => removeTag(index)}
              >
                <span className="mr-1">{field.name}</span>

                <X className="h-4 w-4" />
              </Badge>
            );
          })}
        </ul>

        <Autocomplete
          filter={tagFields.map((field) => field.name)}
          onClick={(val) => {
            appendTag({ name: val });
          }}
        />
      </CardContent>
    </Card>
  );
};
