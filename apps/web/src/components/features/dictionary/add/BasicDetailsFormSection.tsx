import { Trans } from "@lingui/react/macro";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { z } from "@/lib/zod";
import { FormSchema } from "@bahar/schemas";
import { useFormContext } from "react-hook-form";

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
                    type="text"
                    dir="rtl"
                    lang="ar"
                    className="w-full text-xl"
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
                  <Input type="text" className="w-full" {...field} />
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
