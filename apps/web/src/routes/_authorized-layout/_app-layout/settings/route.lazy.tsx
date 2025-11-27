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
import { ImportError, parseImportErrors, ImportErrorCode } from "@/lib/error";
import { tracedFetch } from "@/lib/fetch";
import { useLingui } from "@lingui/react/macro";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { AdminSettingsCardSection } from "@/components/features/settings/AdminSettingsCardSection";
import { useSearch } from "@/hooks/useSearch";
import { getDb } from "@/lib/db";
import {
  readFileAsText,
  batchArray,
  createImportStatements,
  parseImportData,
} from "@/lib/db/import";
import { transformForExport } from "@/lib/db/export";
import {
  RawDictionaryEntry,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { hydrateOramaDb, resetOramaDb } from "@/lib/search";

const Settings = () => {
  const { t } = useLingui();
  const { reset } = useSearch();
  const [file, setFile] = useState<File>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data: userData } = authClient.useSession();

  const exportDictionary = useCallback(
    async (includeFlashcards = false) => {
      try {
        setIsLoading(true);

        const db = getDb();

        const entries: RawDictionaryEntry[] = await db
          .prepare("SELECT * FROM dictionary_entries")
          .all();

        const exportData: unknown[] = [];

        let skippedCount = 0;
        for (const entry of entries) {
          const flashcards: SelectFlashcard[] = await db
            .prepare(
              "SELECT * FROM flashcards WHERE dictionary_entry_id = ? ORDER BY direction",
            )
            .all([entry.id]);

          const result = transformForExport({
            entry,
            flashcards,
            includeFlashcards,
          });

          if (!result.ok) {
            console.warn(
              `Skipping corrupted entry "${result.error.word}" (${result.error.entryId}): ${result.error.field} - ${result.error.reason}`,
            );
            skippedCount++;
            continue;
          }

          exportData.push(result.value);
        }

        if (skippedCount > 0) {
          console.warn(
            `Export completed with ${skippedCount} entries skipped due to data corruption`,
          );
        }

        const data = JSON.stringify(exportData, null, 2);
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

        if (skippedCount > 0) {
          toast({
            variant: "destructive",
            title: t`Export completed with issues`,
            description: t`${skippedCount} entries were skipped due to data corruption.`,
          });
        } else {
          toast({
            title: t`Successfully exported!`,
            description: t`Your dictionary has been downloaded.`,
          });
        }
      } catch (err: unknown) {
        console.error(err);
        toast({
          variant: "destructive",
          title: t`Export failed!`,
          description: t`There was an error exporting your dictionary. Please try again later.`,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [toast, t],
  );

  const deleteDictionary = useCallback(async () => {
    try {
      setIsLoading(true);

      const db = getDb();

      // Delete from local DB (cascades to flashcards)
      await db.prepare("DELETE FROM dictionary_entries").run();
      await db.push();

      tracedFetch(`${import.meta.env.VITE_API_BASE_URL}/dictionary`, {
        method: "DELETE",
        credentials: "include",
      }).catch((err: unknown) => {
        console.error("Failed to delete from Meilisearch:", err);
      });

      reset();
      resetOramaDb();
      await hydrateOramaDb();

      toast({
        title: t`Successfully deleted!`,
        description: t`Your dictionary has been deleted.`,
      });
    } catch (err: unknown) {
      console.error(err);

      toast({
        variant: "destructive",
        title: t`Failed to delete!`,
        description: t`There was an error deleting your dictionary. Please try again later.`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [reset, toast, t]);

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
                const fileContent = await readFileAsText(file);
                let parsedData: unknown;

                try {
                  parsedData = JSON.parse(fileContent);
                } catch {
                  throw new ImportError({
                    message: "Error importing dictionary",
                    error: new Error("Invalid JSON format") as never,
                    code: ImportErrorCode.INVALID_JSON,
                  });
                }

                let parsedImport;
                try {
                  parsedImport = parseImportData(parsedData);
                } catch (err) {
                  throw new ImportError({
                    message: "Error importing dictionary",
                    error: err as never,
                    code: ImportErrorCode.VALIDATION_ERROR,
                  });
                }

                const { version, entries: validatedDictionary } = parsedImport;

                const db = getDb();
                const BATCH_SIZE = 100;

                for (const batch of batchArray(
                  validatedDictionary,
                  BATCH_SIZE,
                )) {
                  for (const word of batch) {
                    const { dictEntry, flashcards } = createImportStatements(
                      word,
                      version,
                    );

                    await db.prepare(dictEntry.sql).run(dictEntry.args);

                    await db.prepare(flashcards[0].sql).run(flashcards[0].args);
                    await db.prepare(flashcards[1].sql).run(flashcards[1].args);
                  }
                }

                await db.push();

                const meilisearchFormData = new FormData();
                meilisearchFormData.append("dictionary", file!);

                tracedFetch(
                  `${import.meta.env.VITE_API_BASE_URL}/dictionary/import`,
                  {
                    method: "POST",
                    body: meilisearchFormData,
                    credentials: "include",
                  },
                ).catch((err: unknown) => {
                  console.error("Failed to sync to Meilisearch:", err);
                });

                reset();
                resetOramaDb();
                await hydrateOramaDb();

                toast({
                  title: t`Successfully imported!`,
                  description: t`Your dictionary has been updated!`,
                });
              } catch (err: unknown) {
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

                  importErrors.forEach((importError) => {
                    toast({
                      variant: "destructive",
                      description: importError,
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

      {userData?.user.role === "admin" && <AdminSettingsCardSection />}
    </Page>
  );
};

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/settings",
)({
  component: Settings,
});
