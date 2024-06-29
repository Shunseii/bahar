import { InputFile } from "@/components/InputFile";
import { LanguageMenu } from "@/components/LanguageMenu";
import { Page } from "@/components/Page";
import { ThemeMenu } from "@/components/ThemeMenu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { ImportError, parseImportErrors } from "@/lib/error";
import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useInstantSearch } from "react-instantsearch";

const Settings = () => {
  const { _ } = useLingui();
  const [file, setFile] = useState<File>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refresh } = useInstantSearch();

  return (
    <Page className="m-auto max-w-4xl w-full flex flex-col gap-y-8">
      <h1 className="text-center text-3xl font-primary font-semibold">
        <Trans>Settings</Trans>
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Appearance</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>Customize how the application looks for you.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-y-4">
          <ThemeMenu />
          <LanguageMenu />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <Trans>Dictionary</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>Import and export your dictionary.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-y-4">
          <form
            className="flex flex-row items-end gap-x-4"
            action="#"
            encType="multipart/form-data"
            onSubmit={async (e) => {
              e.preventDefault();

              setIsLoading(true);

              const formData = new FormData();
              formData.append("dictionary", file!);

              if (!file || file.type !== "application/json") {
                toast({
                  variant: "destructive",
                  title: _(msg`Incorrect file type`),
                  description: _(
                    msg`Please select a JSON file with your dictionary.`,
                  ),
                });

                setIsLoading(false);

                return;
              }

              try {
                const res = await fetch(
                  `${import.meta.env.VITE_API_BASE_URL}/dictionary/import`,
                  {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                  },
                );

                console.log(res.status);

                if (res.status >= 400 && res.status < 500) {
                  const data = await res.json();

                  throw new ImportError({
                    message: "Error importing dictionary",
                    errors: data,
                  });
                } else if (res.status >= 500) {
                  const data = await res.text();

                  throw new Error(data);
                }

                refresh();

                toast({
                  title: _(msg`Successfully imported!`),
                  description: _(msg`Your dictionary has been updated!`),
                });
              } catch (err) {
                if (err instanceof ImportError) {
                  console.error(err.message);

                  toast({
                    variant: "destructive",
                    description: parseImportErrors(err.errors),
                  });

                  toast({
                    variant: "destructive",
                    title: _(msg`Import failed!`),
                    description: _(
                      msg`Your dictionary is not valid. Please fix the errors and upload it again.`,
                    ),
                  });
                } else {
                  console.error(err);

                  toast({
                    variant: "destructive",
                    title: _(msg`Import failed!`),
                    description: _(
                      msg`There was an error importing your dictionary. Please try again later.`,
                    ),
                  });
                }
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <InputFile
              onChange={(file) => {
                setFile(file);
              }}
              accept="application/json"
            />

            <Button
              id="import-dictionary-button"
              type="submit"
              disabled={!file || isLoading}
            >
              <Trans>Import</Trans>
            </Button>
          </form>

          <CardDescription className="text-destructive">
            <Trans>
              Importing a dictionary will overwrite your current one.
            </Trans>
          </CardDescription>
        </CardContent>

        <CardContent>
          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={async () => {
              try {
                setIsLoading(true);

                const response = await fetch(
                  `${import.meta.env.VITE_API_BASE_URL}/dictionary/export`,
                  {
                    method: "POST",
                    credentials: "include",
                  },
                );

                const data = JSON.stringify(await response.json(), null, 2);
                const blob = new Blob([data], { type: "application/json" });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = url;
                link.download = "data.json";
                link.click();

                URL.revokeObjectURL(url);
              } catch (err) {
                console.error(err);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <Trans>Export</Trans>
          </Button>
        </CardContent>
      </Card>
    </Page>
  );
};

export const Route = createLazyFileRoute("/_app-layout/settings")({
  component: Settings,
});
