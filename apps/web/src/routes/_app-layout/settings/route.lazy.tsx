import { Trans } from "@lingui/react/macro";
import { InputFile } from "@/components/InputFile";
import { LanguageMenu } from "@/components/LanguageMenu";
import { Page } from "@/components/Page";
import { ThemeMenu } from "@/components/ThemeMenu";
import { FlashcardSettingsCardSection } from "@/components/features/settings/FlashcardSettingsCardSection";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DialogHeader,
  DialogFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/useToast";
import { ImportError, parseImportErrors } from "@/lib/error";
import { tracedFetch } from "@/lib/fetch";
import { useLingui } from "@lingui/react/macro";
import { createLazyFileRoute } from "@tanstack/react-router";
import { ImportResponseError } from "@/lib/error";
import { useCallback, useState } from "react";
import { useInstantSearch } from "react-instantsearch";

const Settings = () => {
  const { t } = useLingui();
  const [file, setFile] = useState<File>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { refresh } = useInstantSearch();

  const exportDictionary = useCallback(async (includeFlashcards = false) => {
    try {
      setIsLoading(true);

      const response = await tracedFetch(
        `${import.meta.env.VITE_API_BASE_URL}/dictionary/export`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            includeFlashcards,
          }),
        },
      );

      const data = JSON.stringify(await response.json(), null, 2);
      const blob = new Blob([data], { type: "application/json" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const filename = includeFlashcards
        ? "dictionary-backup.json"
        : "dictionary-without-flashcards.json";

      link.href = url;
      link.download = filename;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteDictionary = useCallback(async () => {
    try {
      setIsLoading(true);

      const res = await tracedFetch(
        `${import.meta.env.VITE_API_BASE_URL}/dictionary`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (res.status >= 400) {
        const data = await res.json();
        console.error({
          message: "Unexpected error while deleting dictionary.",
          data,
        });

        throw new Error("Unexpected error");
      }

      refresh();

      toast({
        title: t`Successfully deleted!`,
        description: t`Your dictionary has been deleted.`,
      });
    } catch (err) {
      console.error(err);

      toast({
        variant: "destructive",
        title: t`Failed to delete!`,
        description: t`There was an error deleting your dictionary. Please try again later.`,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
            <Trans>Manage your dictionary.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-y-4">
          <form
            className="flex flex-col sm:flex-row items-start sm:items-end gap-x-4 gap-y-4"
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
                  title: t`Incorrect file type`,
                  description: t`Please select a JSON file with your dictionary.`,
                });

                setIsLoading(false);

                return;
              }

              try {
                const res = await tracedFetch(
                  `${import.meta.env.VITE_API_BASE_URL}/dictionary/import`,
                  {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                  },
                );

                if (res.status >= 400 && res.status < 500) {
                  const { code, error } =
                    (await res.json()) as ImportResponseError;

                  throw new ImportError({
                    message: "Error importing dictionary",
                    error,
                    code,
                  });
                } else if (res.status >= 500) {
                  const data = await res.text();

                  throw new Error(data);
                }

                refresh();

                toast({
                  title: t`Successfully imported!`,
                  description: t`Your dictionary has been updated!`,
                });
              } catch (err) {
                if (err instanceof ImportError) {
                  const { error, code, message } = err;

                  console.error(
                    "Error importing dictionary: ",
                    message,
                    code,
                    error,
                  );

                  const importErrors = parseImportErrors({
                    error,
                    code,
                  });

                  importErrors.forEach((err) => {
                    toast({
                      variant: "destructive",
                      description: err,
                    });
                  });

                  toast({
                    variant: "destructive",
                    title: t`Import failed!`,
                    description: t`Your dictionary is not valid. Please fix the errors and upload it again.`,
                  });
                } else {
                  console.error(err);

                  toast({
                    variant: "destructive",
                    title: t`Import failed!`,
                    description: t`There was an error importing your dictionary. Please try again later.`,
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
            <Trans>Any words that have the same ID will be overwritten.</Trans>
          </CardDescription>
        </CardContent>

        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" disabled={isLoading}>
                <Trans>Export</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Trans>Export your dictionary</Trans>
                </DialogTitle>

                <DialogDescription>
                  <Trans>
                    Exporting dictionary with flaschards will save your
                    flashcard progress along with all the content in your
                    dictionary. Use this option if you want to make a backup of
                    your data.
                    <br />
                    <br />
                    Exporting your dictionary without flashcards will not save
                    any flashcard progress. Use this option if you want to share
                    your dictionary.
                    <br />
                    <br />
                    <strong>Warning</strong>: Importing your file without
                    flashcards will reset all of your flashcards.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <div className="flex gap-4 justify-end">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => exportDictionary(false)}
                  >
                    <Trans>Export</Trans>
                  </Button>

                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => exportDictionary(true)}
                  >
                    <Trans>Export with flashcards</Trans>
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>

        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" disabled={isLoading}>
                <Trans>Delete</Trans>
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  <Trans>Delete your dictionary?</Trans>
                </DialogTitle>

                <DialogDescription>
                  <Trans>
                    Are you sure you want to delete your dictionary? All your
                    words will be deleted permanently. This action cannot be
                    undone. Please make sure to export your dictionary before
                    deleting it.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="gap-y-4">
                <DialogClose asChild>
                  <Button variant="destructive" onClick={deleteDictionary}>
                    <Trans>Delete</Trans>
                  </Button>
                </DialogClose>

                <DialogClose asChild>
                  <Button variant="outline">
                    <Trans>Cancel</Trans>
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      <FlashcardSettingsCardSection />
    </Page>
  );
};

export const Route = createLazyFileRoute("/_app-layout/settings")({
  component: Settings,
});
