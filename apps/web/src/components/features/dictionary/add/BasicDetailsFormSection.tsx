import { Trans } from "@lingui/react/macro";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { FormSchema } from "@/lib/schemas/dictionary";
import type { z } from "@/lib/zod";

export const BasicDetailsFormSection = () => {
  const form = useFormContext<z.infer<typeof FormSchema>>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Basic Details</Trans>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="grid gap-6">
          <FormField
            control={form.control}
            name="word"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Word</Trans>*
                </FormLabel>

                <FormControl>
                  <Input
                    className="w-full text-xl"
                    dir="rtl"
                    lang="ar"
                    type="text"
                    {...field}
                  />
                </FormControl>

                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="translation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Translation</Trans>*
                </FormLabel>

                <FormControl>
                  <Input className="w-full" type="text" {...field} />
                </FormControl>

                <FormDescription>
                  <Trans>An English translation of the word.</Trans>
                </FormDescription>

                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};
