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
import { Trans } from "@lingui/macro";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useInstantSearch } from "react-instantsearch";

const Settings = () => {
  const [file, setFile] = useState<File>();
  const [isLoading, setIsLoading] = useState(false);
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

              try {
                await fetch(
                  `${import.meta.env.VITE_API_BASE_URL}/dictionary/import`,
                  {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                  },
                );

                refresh();
              } catch (err) {
                console.error(err);
              } finally {
                setIsLoading(false);
              }
            }}
          >
            <InputFile
              onChange={(e) => {
                setFile(e?.target?.files?.[0]);
              }}
            />

            <Button type="submit" disabled={!file || isLoading}>
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
