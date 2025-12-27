import type {
  RawDictionaryEntry,
  SelectFlashcard,
} from "@bahar/drizzle-user-db-schemas";
import { Button } from "@bahar/web-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bahar/web-ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@bahar/web-ui/components/dialog";
import { Trans, useLingui } from "@lingui/react/macro";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { AdminSettingsCardSection } from "@/components/features/settings/AdminSettingsCardSection";
import { FlashcardSettingsCardSection } from "@/components/features/settings/FlashcardSettingsCardSection";
import { InputFile } from "@/components/InputFile";
import { LanguageMenu } from "@/components/LanguageMenu";
import { Page } from "@/components/Page";
import { ThemeMenu } from "@/components/ThemeMenu";
import { useSearch } from "@/hooks/useSearch";
import { authClient } from "@/lib/auth-client";
import { ensureDb } from "@/lib/db";
import { transformForExport } from "@/lib/db/export";
import {
  batchArray,
  createImportStatements,
  parseImportData,
  readFileAsText,
} from "@/lib/db/import";
import { enqueueDbOperation, enqueueSyncOperation } from "@/lib/db/queue";
import { ImportError, ImportErrorCode, parseImportErrors } from "@/lib/error";
import { hydrateOramaDb, resetOramaDb } from "@/lib/search";

const Settings = () => {
  const { t } = useLingui();
  const { reset } = useSearch();
  const [file, setFile] = useState<File>();
  const [isLoading, setIsLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const { data: userData } = authClient.useSession();

  const exportDictionary = useCallback(
    async (includeFlashcards = false) => {
      try {
        setIsLoading(true);

        const db = await ensureDb();

        const entries: RawDictionaryEntry[] = await db
          .prepare("SELECT * FROM dictionary_entries")
          .all();

        const exportData: unknown[] = [];

        let skippedCount = 0;
        for (const entry of entries) {
          const flashcards: SelectFlashcard[] = await db
            .prepare(
              "SELECT * FROM flashcards WHERE dictionary_entry_id = ? ORDER BY direction"
            )
            .all([entry.id]);

          const result = transformForExport({
            entry,
            flashcards,
            includeFlashcards,
          });

          if (!result.ok) {
            console.warn(
              `Skipping corrupted entry "${result.error.word}" (${result.error.entryId}): ${result.error.field} - ${result.error.reason}`
            );
            skippedCount++;
            continue;
          }

          exportData.push(result.value);
        }

        if (skippedCount > 0) {
          console.warn(
            `Export completed with ${skippedCount} entries skipped due to data corruption`
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
          toast.error(t`Export completed with issues`, {
            description: t`${skippedCount} entries were skipped due to data corruption.`,
          });
        } else {
          toast.success(t`Successfully exported!`, {
            description: t`Your dictionary has been downloaded.`,
          });
        }
      } catch (err: unknown) {
        console.error(err);
        toast.error(t`Export failed!`, {
          description: t`There was an error exporting your dictionary. Please try again later.`,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  const deleteDictionary = useCallback(async () => {
    try {
      setIsLoading(true);

      // Delete from local DB (cascades to flashcards)
      await enqueueDbOperation(async () => {
        const db = await ensureDb();
        await db.prepare("DELETE FROM dictionary_entries").run();
      });

      await enqueueSyncOperation(async () => {
        const db = await ensureDb();
        await db.push();
        await db.checkpoint();
      });

      reset();
      resetOramaDb();
      const hydrateResult = await hydrateOramaDb();
      if (!hydrateResult.ok) {
        window.location.reload();
        return;
      }

      toast.success(t`Successfully deleted!`, {
        description: t`Your dictionary has been deleted.`,
      });
    } catch (err: unknown) {
      console.error(err);

      toast.error(t`Failed to delete!`, {
        description: t`There was an error deleting your dictionary. Please try again later.`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [reset, t]);

  return (
    <Page className="m-auto flex w-full max-w-4xl flex-col gap-y-8">
      <h1 className="text-center font-primary font-semibold text-3xl">
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
            action="#"
            className="flex flex-col items-start gap-x-4 gap-y-4 sm:flex-row sm:items-end"
            encType="multipart/form-data"
            onSubmit={async (e) => {
              e.preventDefault();

              setIsLoading(true);

              if (!file || file.type !== "application/json") {
                toast.error(t`Incorrect file type`, {
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

                const BATCH_SIZE = 100;
                const batches = [
                  ...batchArray(validatedDictionary, BATCH_SIZE),
                ];
                const totalBatches = batches.length;

                setImportProgress({ current: 0, total: totalBatches });

                await enqueueDbOperation(async () => {
                  const db = await ensureDb();

                  const insertBatch = db.transaction(
                    async (batch: typeof validatedDictionary) => {
                      for (const word of batch) {
                        const { dictEntry, flashcards } =
                          createImportStatements(word, version);

                        await db.prepare(dictEntry.sql).run(dictEntry.args);
                        await db
                          .prepare(flashcards[0].sql)
                          .run(flashcards[0].args);
                        await db
                          .prepare(flashcards[1].sql)
                          .run(flashcards[1].args);
                      }
                    }
                  );

                  for (let i = 0; i < batches.length; i++) {
                    await insertBatch(batches[i]);
                    setImportProgress({ current: i + 1, total: totalBatches });
                  }
                });

                await enqueueSyncOperation(async () => {
                  const db = await ensureDb();
                  await db.push();
                  await db.checkpoint();
                });

                reset();
                resetOramaDb();
                const hydrateResult = await hydrateOramaDb();
                if (!hydrateResult.ok) {
                  window.location.reload();
                  return;
                }

                toast.success(t`Successfully imported!`, {
                  description: t`Your dictionary has been updated!`,
                });
              } catch (err: unknown) {
                if (err instanceof ImportError) {
                  const { error, code, message } = err;

                  console.error(
                    "Error importing dictionary: ",
                    message,
                    code,
                    error
                  );

                  const importErrors = parseImportErrors({
                    error,
                    code,
                  });

                  importErrors.forEach((importError) => {
                    toast.error(importError);
                  });

                  toast.error(t`Import failed!`, {
                    description: t`Your dictionary is not valid. Please fix the errors and upload it again.`,
                  });
                } else {
                  console.error(err);

                  toast.error(t`Import failed!`, {
                    description: t`There was an error importing your dictionary. Please try again later.`,
                  });
                }
              } finally {
                setIsLoading(false);
                setImportProgress(null);
              }
            }}
          >
            <InputFile
              accept="application/json"
              onChange={(file) => {
                setFile(file);
              }}
            />

            <Button
              disabled={!file || isLoading}
              id="import-dictionary-button"
              type="submit"
            >
              <Trans>Import</Trans>
            </Button>
          </form>

          {importProgress && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-150"
                  style={{
                    width: `${
                      (importProgress.current / importProgress.total) * 100
                    }%`,
                  }}
                />
              </div>
              <p className="text-center text-muted-foreground text-xs">
                {Math.round(
                  (importProgress.current / importProgress.total) * 100
                )}
                %
              </p>
            </div>
          )}

          <CardDescription className="text-destructive">
            <Trans>Any words that have the same ID will be overwritten.</Trans>
          </CardDescription>
        </CardContent>

        <CardContent>
          <Dialog>
            <DialogTrigger asChild>
              <Button disabled={isLoading} variant="secondary">
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
                <div className="flex justify-end gap-4">
                  <Button
                    onClick={() => exportDictionary(false)}
                    type="button"
                    variant="secondary"
                  >
                    <Trans>Export</Trans>
                  </Button>

                  <Button
                    onClick={() => exportDictionary(true)}
                    type="button"
                    variant="secondary"
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
              <Button disabled={isLoading} variant="destructive">
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
                  <Button onClick={deleteDictionary} variant="destructive">
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
  "/_authorized-layout/_app-layout/settings"
)({
  component: Settings,
});
