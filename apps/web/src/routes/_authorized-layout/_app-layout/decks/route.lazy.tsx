import { Trans } from "@lingui/react/macro";
import { DeckDialogContent } from "@/components/features/decks/DeckDialogContent";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useLingui } from "@lingui/react/macro";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { createLazyFileRoute } from "@tanstack/react-router";
import { MoreHorizontal, Plus } from "lucide-react";
import { FlashcardDrawer } from "@/components/features/flashcards/FlashcardDrawer";
import { queryClient } from "@/lib/query";
import { getQueryKey } from "@trpc/react-query";
import { useToast } from "@/hooks/useToast";
import { Page } from "@/components/Page";
import { useQuery, useMutation } from "@tanstack/react-query";
import { settingsTable } from "@/lib/db/operations/settings";
import { decksTable } from "@/lib/db/operations/decks";

const Decks = () => {
  const { data: settingsData } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  const { data } = useQuery({
    queryFn: ({ queryKey: [, showReverse] }) =>
      decksTable.list.query({
        show_reverse: (showReverse as boolean | null) ?? undefined,
      }),
    ...decksTable.list.cacheOptions,
    queryKey: [
      ...decksTable.list.cacheOptions.queryKey,
      settingsData?.show_reverse_flashcards,
    ],
  });

  const { mutateAsync: deleteDeck } = trpc.decks.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...getQueryKey(trpc.decks.list), { type: "query" }],
      });
    },
  });

  const { mutateAsync: deleteDeckLocal } = useMutation({
    mutationFn: decksTable.delete.mutation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: decksTable.list.cacheOptions.queryKey,
      });
    },
  });

  const { toast } = useToast();
  const { t } = useLingui();
  const { formatNumber } = useFormatNumber();

  return (
    <Page className="m-auto max-w-4xl w-full flex flex-col gap-y-8">
      <Dialog>
        <DialogTrigger asChild className="w-max self-end">
          <Button size="sm" variant="outline">
            <span className="flex gap-x-2 items-center">
              <Plus className="h-5 w-5" />

              <Trans>Create deck</Trans>
            </span>
          </Button>
        </DialogTrigger>

        <DeckDialogContent />
      </Dialog>

      <Card className="w-full m-auto max-w-[90vw]">
        <CardHeader>
          <CardTitle>
            <Trans>Decks</Trans>
          </CardTitle>

          <CardDescription>
            <Trans>Manage your decks and study them.</Trans>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {data?.length === 0 ? (
            <div className="flex flex-col gap-y-4 font-primary">
              <p>
                <Trans>You have no decks yet.</Trans>
              </p>

              <p>
                <Trans>
                  Decks allow you to create subsets of your existing flashcards
                  by using filters on your dictionary which you can then study
                  individually.
                </Trans>
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Trans>Name</Trans>
                  </TableHead>

                  <TableHead>
                    <Trans>To review</Trans>
                  </TableHead>

                  <TableHead>
                    <Trans>Backlog</Trans>
                  </TableHead>

                  <TableHead>
                    <Trans>Total</Trans>
                  </TableHead>

                  <TableHead>
                    <span className="sr-only">
                      <Trans>Actions</Trans>
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data?.map((deck) => (
                  <TableRow key={deck.id}>
                    <TableCell className="font-medium">{deck.name}</TableCell>

                    <TableCell className="font-medium">
                      {formatNumber(deck.to_review)}
                    </TableCell>

                    <TableCell className="font-medium">
                      {deck.to_review_backlog > 0
                        ? formatNumber(deck.to_review_backlog)
                        : "-"}
                    </TableCell>

                    <TableCell className="font-medium text-muted-foreground">
                      {formatNumber(deck.total_hits)}
                    </TableCell>

                    <TableCell className="flex justify-between">
                      <FlashcardDrawer
                        filters={deck.filters ?? undefined}
                        show_reverse={
                          settingsData?.show_reverse_flashcards ?? undefined
                        }
                        queueCounts={{
                          regular: deck.to_review,
                          backlog: deck.to_review_backlog,
                        }}
                      >
                        <Button variant="outline" size="sm">
                          <Trans>Study</Trans>
                        </Button>
                      </FlashcardDrawer>

                      <Dialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>
                              <Trans>Actions</Trans>
                            </DropdownMenuLabel>

                            <DialogTrigger className="w-full cursor-pointer self-end">
                              <DropdownMenuItem className="cursor-pointer">
                                <Trans>Edit</Trans>
                              </DropdownMenuItem>
                            </DialogTrigger>

                            <DropdownMenuItem
                              onClick={async () => {
                                await Promise.all([
                                  deleteDeck({ id: deck.id }),
                                  deleteDeckLocal({ id: deck.id }),
                                ]);

                                toast({
                                  title: t`Deck successfully deleted!`,
                                  description: t`The deck "${deck.name}" has been deleted.`,
                                });
                              }}
                              className="cursor-pointer"
                            >
                              <Trans>Delete</Trans>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <DeckDialogContent deck={deck} />
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Page>
  );
};

export const Route = createLazyFileRoute(
  "/_authorized-layout/_app-layout/decks",
)({
  component: Decks,
});
