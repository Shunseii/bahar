import { Trans } from "@lingui/react/macro";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/useToast";
import { trpcNew } from "@/lib/trpc";
import { z } from "@/lib/zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLingui } from "@lingui/react/macro";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";

const FormSchema = z.object({
  sqlScript: z.string(),
  description: z.string(),
});

export const AdminSettingsCardSection = () => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { mutate } = useMutation({
    ...trpcNew.migrations.registerSchema.mutationOptions(),
    onSuccess: () => {
      toast({ title: t`Migration successfully registered.` });
    },
    onError: (error) => {
      if (error.message === "UNAUTHORIZED") {
        toast({
          title: t`Failed to upload migration`,
          description: t`You do not have access to upload schema migrations.`,
        });
      } else {
        toast({
          title: t`Failed to upload migration`,
          description: t`There was an error uploading your SQL migration`,
        });
      }
    },
  });
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      sqlScript: "",
      description: "",
    },
  });

  const onSubmit = useCallback(
    (data: z.infer<typeof FormSchema>) => {
      mutate(data);
    },
    [mutate],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Trans>Schema Migrations</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>Add a new SQL migration.</Trans>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-y-4 mb-4">
              <FormField
                control={form.control}
                name="sqlScript"
                rules={{ required: true }}
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>
                      <Trans>SQL Script</Trans>*
                    </FormLabel>

                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t`Enter your SQL migration script here`}
                        className="w-full"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>
                      <Trans>Description</Trans>
                    </FormLabel>

                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t`Enter a description for your migration`}
                        className="w-full"
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-max"
                disabled={
                  !form.formState.isDirty || form.formState.isSubmitting
                }
              >
                <Trans>Save</Trans>
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
