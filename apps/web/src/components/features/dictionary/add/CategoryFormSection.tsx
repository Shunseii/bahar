import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDir } from "@/hooks/useDir";
import { z } from "@/lib/zod";
import { FormSchema } from "@/schemas/dictionary";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { InfoIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";

export const CategoryFormSection = () => {
  const { _ } = useLingui();
  const dir = useDir();
  const form = useFormContext<z.infer<typeof FormSchema>>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Category</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>
            How the word is categorized based on its type or context.
          </Trans>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6">
          <div className="grid gap-3">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-x-2">
                    <FormLabel>
                      <Trans>Type</Trans>
                    </FormLabel>

                    <Popover>
                      <PopoverTrigger>
                        <InfoIcon className="h-4 w-4" />
                      </PopoverTrigger>

                      <PopoverContent className="text-sm" side="right">
                        <ul>
                          <li className="flex flex-row gap-x-2">
                            <p>
                              <strong>
                                <Trans>Ism</Trans>:
                              </strong>
                            </p>

                            <p>
                              <Trans>
                                A noun, adjective, adverb or pronoun, and
                                anything that is not a verb or preposition.
                              </Trans>
                            </p>
                          </li>
                          <li className="flex flex-row gap-x-2">
                            <p>
                              <strong>
                                <Trans>Fi'l</Trans>:
                              </strong>
                            </p>

                            <p>
                              <Trans>A verb.</Trans>
                            </p>
                          </li>
                          <li className="flex flex-row gap-x-2">
                            <p>
                              <strong>
                                <Trans>Harf</Trans>:
                              </strong>
                            </p>

                            <p>
                              <Trans>A preposition or conjunction.</Trans>
                            </p>
                          </li>
                        </ul>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    dir={dir}
                  >
                    <FormControl>
                      <SelectTrigger id="type" aria-label={_(msg`Select type`)}>
                        <SelectValue placeholder={_(msg`Select type`)} />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="ism">
                        <Trans>Ism</Trans>
                      </SelectItem>
                      <SelectItem value="fi'l">
                        <Trans>Fi'l</Trans>
                      </SelectItem>
                      <SelectItem value="harf">
                        <Trans>Harf</Trans>
                      </SelectItem>
                      <SelectItem value="expression">
                        <Trans>Expression</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
