import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { api } from "@/lib/api";
import { z } from "@/lib/zod";

const FormSchema = z.object({
  sqlScript: z.string(),
  description: z.string(),
});

export const AdminSettingsCardSection = () => {
  const { t } = useLingui();
  const { toast } = useToast();
  const { mutate } = useMutation({
    mutationFn: async (
      data: Parameters<typeof api.migrations.register.post>[0]
    ) => {
      const { data: result, error } = await api.migrations.register.post(data);

      switch (error?.status) {
        case 401:
        case 403:
          toast({
            title: t`Failed to upload migration`,
            description: t`You do not have access to upload schema migrations.`,
          });
          break;

        case 400:
        case 422:
          toast({
            title: t`Failed to upload migration`,
            description: t`There was an error uploading your SQL migration`,
          });
          break;
      }

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({ title: t`Migration successfully registered.` });
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
    [mutate]
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
            <div className="mb-4 flex flex-col gap-y-4">
              <FormField
                control={form.control}
                name="sqlScript"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>
                      <Trans>SQL Script</Trans>*
                    </FormLabel>

                    <FormControl>
                      <Textarea
                        {...field}
                        className="w-full"
                        placeholder={t`Enter your SQL migration script here`}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
                rules={{ required: true }}
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
                        className="w-full"
                        placeholder={t`Enter a description for your migration`}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                className="w-max"
                disabled={
                  !form.formState.isDirty || form.formState.isSubmitting
                }
                type="submit"
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
