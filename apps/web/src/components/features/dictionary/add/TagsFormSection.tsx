import { Badge } from "@bahar/web-ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import { Trans } from "@lingui/react/macro";
import { X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Autocomplete } from "@/components/Autocomplete";
import type { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

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
        <ul className="mb-2 flex flex-wrap gap-2">
          {tagFields.map((field, index) => {
            return (
              <Badge
                className="cursor-pointer"
                key={field.id}
                onClick={() => removeTag(index)}
                variant="secondary"
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
