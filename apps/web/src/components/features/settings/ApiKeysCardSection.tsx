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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bahar/web-ui/components/form";
import { Input } from "@bahar/web-ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@bahar/web-ui/components/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDir } from "@/hooks/useDir";
import { authClient } from "@/lib/auth-client";
import { intlFormatDistance } from "@/lib/date";
import { SECONDS_IN_DAY } from "@/lib/date/constants";
import { queryClient } from "@/lib/query";
import { z } from "@/lib/zod";

type ApiKey = NonNullable<
  Awaited<ReturnType<typeof authClient.apiKey.list>>["data"]
>[number];

const apiKeysQueryOptions = {
  queryKey: ["auth.apiKeys"],
  queryFn: async (): Promise<ApiKey[]> => {
    const { data, error } = await authClient.apiKey.list();

    if (error) {
      throw new Error(error.message ?? "Failed to load API keys");
    }

    return data ?? [];
  },
} as const;

/**
 * Expiry choices offered when creating a key. better-auth clamps custom
 * expiries to its `minExpiresIn`/`maxExpiresIn` window (1 to 365 days), so
 * these are the widest span the plugin accepts. There is deliberately no
 * "never expires" option -- the plugin only reaches a null `expiresAt` when
 * `keyExpiration.defaultExpiresIn` is unset, which would also uncap keys minted
 * by `bahar login`.
 */
const EXPIRY_DAY_OPTIONS = ["7", "30", "90", "365"] as const;

const FormSchema = z.object({
  name: z.string().min(1),
  expiryDays: z.enum(EXPIRY_DAY_OPTIONS),
});

type FormValues = z.infer<typeof FormSchema>;

const CreateKeyDialog = ({
  onCreated,
  onOpenChange,
  open,
}: {
  onCreated: (key: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const { t } = useLingui();
  const dir = useDir();

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { name: "", expiryDays: "30" },
  });

  const { mutateAsync: createKey } = useMutation({
    mutationFn: async ({ name, expiryDays }: FormValues) => {
      const { data, error } = await authClient.apiKey.create({
        name,
        expiresIn: Number(expiryDays) * SECONDS_IN_DAY,
      });

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create API key");
      }

      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiKeysQueryOptions.queryKey,
      });
    },
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      try {
        const created = await createKey(values);

        form.reset();
        onCreated(created.key);
      } catch (_err) {
        toast.error(t`Failed to create API key`, {
          description: t`Please try again later.`,
        });
      }
    },
    [createKey, form, onCreated, t]
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create an API key</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              The key is shown once, right after it's created. Store it
              somewhere safe.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="flex flex-col gap-y-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Name</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input placeholder={t`My agent`} {...field} />
                  </FormControl>

                  <FormDescription>
                    <Trans>So you can tell your keys apart later.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiryDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Expires in</Trans>
                  </FormLabel>

                  <Select
                    dir={dir}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value="7">
                        <Trans>7 days</Trans>
                      </SelectItem>

                      <SelectItem value="30">
                        <Trans>30 days</Trans>
                      </SelectItem>

                      <SelectItem value="90">
                        <Trans>90 days</Trans>
                      </SelectItem>

                      <SelectItem value="365">
                        <Trans>1 year</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-y-4">
              <Button disabled={form.formState.isSubmitting} type="submit">
                <Trans>Create key</Trans>
              </Button>

              <DialogClose asChild>
                <Button type="button" variant="outline">
                  <Trans>Cancel</Trans>
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const CreatedKeyDialog = ({
  apiKey,
  onOpenChange,
}: {
  apiKey: string | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const { t } = useLingui();

  const copyKey = useCallback(async () => {
    if (!apiKey) return;

    await navigator.clipboard.writeText(apiKey);
    toast.success(t`Copied to clipboard`);
  }, [apiKey, t]);

  return (
    <Dialog onOpenChange={onOpenChange} open={!!apiKey}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            <Trans>Your new API key</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Copy it now — you won't be able to see it again. Anyone with this
              key can read and write your dictionary.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-x-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-sm">
            {apiKey}
          </code>

          <Button
            aria-label={t`Copy API key`}
            onClick={copyKey}
            size="icon"
            variant="outline"
          >
            <Copy size={16} />
          </Button>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">
              <Trans>Done</Trans>
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ApiKeyRow = ({ apiKey }: { apiKey: ApiKey }) => {
  const { i18n, t } = useLingui();
  const [isRevoking, setIsRevoking] = useState(false);

  const { mutateAsync: revokeKey } = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await authClient.apiKey.delete({ keyId });

      if (error) {
        throw new Error(error.message ?? "Failed to revoke API key");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: apiKeysQueryOptions.queryKey,
      });
    },
  });

  const handleRevoke = useCallback(async () => {
    try {
      setIsRevoking(true);
      await revokeKey(apiKey.id);

      toast.success(t`API key revoked`);
    } catch (_err) {
      toast.error(t`Failed to revoke API key`, {
        description: t`Please try again later.`,
      });
    } finally {
      setIsRevoking(false);
    }
  }, [apiKey.id, revokeKey, t]);

  const now = new Date();
  const expiresAt = apiKey.expiresAt ? new Date(apiKey.expiresAt) : null;
  const lastRequest = apiKey.lastRequest ? new Date(apiKey.lastRequest) : null;
  const isExpired = !!expiresAt && expiresAt.getTime() <= now.getTime();
  const label = apiKey.name ?? t`Unnamed key`;

  return (
    <div className="flex flex-row items-center justify-between gap-4 rounded-lg border p-4">
      <div className="flex min-w-0 flex-col gap-y-1">
        <p className="truncate font-medium text-sm">{label}</p>

        <code className="truncate font-mono text-muted-foreground text-xs">
          {apiKey.start}…
        </code>

        <p className="text-muted-foreground text-xs">
          {lastRequest ? (
            <Trans>
              Last used{" "}
              {
                intlFormatDistance(lastRequest, now, {
                  locale: i18n.locale,
                }).label
              }
            </Trans>
          ) : (
            <Trans>Never used</Trans>
          )}

          {expiresAt && (
            <>
              {" · "}
              {isExpired ? (
                <Trans>Expired</Trans>
              ) : (
                <Trans>
                  Expires{" "}
                  {
                    intlFormatDistance(expiresAt, now, {
                      locale: i18n.locale,
                    }).label
                  }
                </Trans>
              )}
            </>
          )}
        </p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          {/* Named per key so a screen reader announces which key this revokes
              -- the visible label is just "Revoke" on every row. */}
          <Button
            aria-label={t`Revoke ${label}`}
            disabled={isRevoking}
            variant="destructive"
          >
            <Trans>Revoke</Trans>
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              <Trans>Revoke this API key?</Trans>
            </DialogTitle>

            <DialogDescription>
              <Trans>
                Anything using this key stops working immediately. This can't be
                undone.
              </Trans>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-y-4">
            <DialogClose asChild>
              <Button onClick={handleRevoke} variant="destructive">
                <Trans>Revoke</Trans>
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
    </div>
  );
};

export const ApiKeysCardSection = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const { data: apiKeys, isPending, isError } = useQuery(apiKeysQueryOptions);

  const handleCreated = useCallback((key: string) => {
    setIsCreateOpen(false);
    setCreatedKey(key);
  }, []);

  return (
    <Card>
      <CardHeader id="api-keys">
        <CardTitle>
          <Trans>API keys</Trans>
        </CardTitle>

        <CardDescription>
          <Trans>
            Keys let the Bahar CLI and other tools read and write your
            dictionary on your behalf.
          </Trans>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-y-4">
        {isError && (
          <p className="text-destructive text-sm">
            <Trans>Couldn't load your API keys. Please try again later.</Trans>
          </p>
        )}

        {!isError && isPending && (
          <p className="text-muted-foreground text-sm">
            <Trans>Loading…</Trans>
          </p>
        )}

        {!(isError || isPending) && apiKeys.length === 0 && (
          <p className="text-muted-foreground text-sm">
            <Trans>
              You don't have any API keys yet. Signing in with `bahar login`
              creates one for you.
            </Trans>
          </p>
        )}

        {!(isError || isPending) && apiKeys.length > 0 && (
          <div className="flex flex-col gap-y-2">
            {apiKeys.map((apiKey) => (
              <ApiKeyRow apiKey={apiKey} key={apiKey.id} />
            ))}
          </div>
        )}

        <div>
          <Button onClick={() => setIsCreateOpen(true)} variant="outline">
            <Trans>Create key</Trans>
          </Button>
        </div>
      </CardContent>

      <CreateKeyDialog
        onCreated={handleCreated}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
      />

      <CreatedKeyDialog
        apiKey={createdKey}
        onOpenChange={() => setCreatedKey(null)}
      />
    </Card>
  );
};
