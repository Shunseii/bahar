import { enqueueDbOperation } from "@bahar/db-operations";
import {
  decks,
  dictionaryEntries,
  flashcards,
  type ShowAntonymsMode,
} from "@bahar/drizzle-user-db-schemas";
import { Trans, useLingui } from "@lingui/react/macro";
import * as Sentry from "@sentry/react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sql } from "drizzle-orm";
import { reloadAppAsync } from "expo";
import {
  Bell,
  Brain,
  CreditCard,
  ExternalLink,
  FolderSync,
  Languages,
  Palette,
  Settings,
  Trash2,
} from "lucide-react-native";
import type React from "react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { toast } from "sonner-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { useFormatNumber } from "@/hooks/useFormatNumber";
import { useSearch } from "@/hooks/useSearch";
import { useUserPlan } from "@/hooks/useUserPlan";
import { deleteLocalDb, ensureDb, resetDb } from "@/lib/db";
import { getDrizzleDb } from "@/lib/db/adapter";
import {
  clampPostponeWindow,
  DEFAULT_BACKLOG_THRESHOLD_DAYS,
  DEFAULT_POSTPONE_WINDOW_DAYS,
  flashcardsTable,
  MIN_POSTPONE_WINDOW_DAYS,
  type PostponeScope,
  postponeCardsPerDay,
  settingsTable,
} from "@/lib/db/operations";
import { performSync } from "@/lib/db/sync";
import { resetOramaDb } from "@/lib/search";
import { useThemeColors } from "@/lib/theme";
import { api, queryClient } from "@/utils/api";
import { authClient } from "@/utils/auth-client";

interface SettingsFormValues {
  show_antonyms_in_flashcard: ShowAntonymsMode;
  create_reverse_by_default: boolean;
}

interface SettingRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  children,
}) => (
  <View className="flex-row items-center justify-between py-3">
    <View className="mr-4 flex-1">
      <Text className="font-medium text-base text-foreground">{title}</Text>
      {description && (
        <Text className="mt-0.5 text-muted-foreground text-sm">
          {description}
        </Text>
      )}
    </View>
    {children}
  </View>
);

interface SelectOptionProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

const SelectOptions: React.FC<SelectOptionProps> = ({
  options,
  value,
  onChange,
}) => {
  return (
    <View className="flex-row gap-2">
      {options.map((option) => (
        <Pressable
          className={`rounded-md border px-3 py-2 ${
            value === option.value
              ? "border-primary bg-primary/10"
              : "border-border bg-background"
          }`}
          key={option.value}
          onPress={() => onChange(option.value)}
        >
          <Text
            className={`text-sm ${
              value === option.value
                ? "font-medium text-primary"
                : "text-foreground"
            }`}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
};

const BillingCard = () => {
  const colors = useThemeColors();
  const { t } = useLingui();
  const { isFreeUser } = useUserPlan();

  const planName = !isFreeUser ? t`Pro` : t`Free`;

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <CreditCard color={colors.mutedForeground} size={18} />
          <CardTitle>
            <Trans>Billing</Trans>
          </CardTitle>
        </View>
      </CardHeader>
      <CardContent>
        <View className="gap-4">
          <View>
            <Text className="text-muted-foreground text-sm">
              <Trans>Current plan</Trans>
            </Text>
            <Text className="font-semibold text-foreground text-xl">
              {planName}
            </Text>
          </View>
          <Button
            Icon={ExternalLink}
            onPress={() =>
              Linking.openURL("https://bahar.dev/settings#billing")
            }
            variant="outline"
          >
            <Trans>Manage Account</Trans>
          </Button>
        </View>
      </CardContent>
    </Card>
  );
};

const NotificationsCard = () => {
  const colors = useThemeColors();
  const { t } = useLingui();
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: consent } = useQuery({
    queryKey: ["marketing", "consent"] as const,
    queryFn: async () => {
      const { data } = await api.marketing.consent.get();
      return data?.consent ?? null;
    },
  });

  const hasConsented = consent?.action === "granted";

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      await api.marketing.consent.post({
        consent: checked,
        source: "app_settings",
      });
      queryClient.invalidateQueries({ queryKey: ["marketing", "consent"] });
      toast.success(
        checked
          ? t`Subscribed to marketing emails`
          : t`Unsubscribed from marketing emails`
      );
    } catch {
      toast.error(t`Failed to update preference`);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-2">
          <Bell color={colors.mutedForeground} size={18} />
          <CardTitle>
            <Trans>Notifications</Trans>
          </CardTitle>
        </View>
      </CardHeader>
      <CardContent>
        <View className="flex-row items-center justify-between">
          <View className="mr-4 flex-1">
            <Text className="font-medium text-base text-foreground">
              <Trans>Marketing emails</Trans>
            </Text>
            <Text className="mt-0.5 text-muted-foreground text-sm">
              <Trans>
                Receive product updates, tips, and new feature announcements.
              </Trans>
            </Text>
          </View>
          <Switch
            disabled={isUpdating}
            onValueChange={handleToggle}
            thumbColor="white"
            trackColor={{ false: colors.muted, true: colors.primary }}
            value={hasConsented}
          />
        </View>
      </CardContent>
    </Card>
  );
};

export default function SettingsScreen() {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const { t } = useLingui();
  const { formatNumber } = useFormatNumber();
  const { scrollHandler } = useCollapsibleHeader(t`Settings`);
  const { reset: resetSearch } = useSearch();

  const { data: settings, isLoading } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  const { control, reset } = useForm<SettingsFormValues>({
    defaultValues: {
      show_antonyms_in_flashcard: "answer",
      create_reverse_by_default: false,
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        show_antonyms_in_flashcard:
          settings.show_antonyms_in_flashcard ?? "answer",
        create_reverse_by_default: settings.create_reverse_by_default ?? false,
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: settingsTable.getSettings.cacheOptions.queryKey,
      });
    },
    onError: () => toast.error(t`Failed to update settings`),
  });

  const [postponeProgress, setPostponeProgress] = useState<{
    total: number;
    postponed: number;
  } | null>(null);
  const [postponeScope, setPostponeScope] = useState<PostponeScope>("all");
  // Held as the raw string so the field can be empty mid-edit instead of
  // snapping back to a number the moment the user clears it.
  const [windowInput, setWindowInput] = useState(
    String(DEFAULT_POSTPONE_WINDOW_DAYS)
  );

  const { data: counts } = useQuery({
    queryFn: () => flashcardsTable.counts.query(),
    ...flashcardsTable.counts.cacheOptions,
  });

  const scopeCount =
    (postponeScope === "all" ? counts?.total : counts?.backlog) ?? 0;
  const hasNothingToPostpone = scopeCount === 0;

  const parsedWindow = Number(windowInput);
  const isWindowValid =
    windowInput.trim() !== "" &&
    Number.isInteger(parsedWindow) &&
    parsedWindow >= MIN_POSTPONE_WINDOW_DAYS &&
    parsedWindow ===
      clampPostponeWindow({ windowDays: parsedWindow, cardCount: scopeCount });

  const windowDays = clampPostponeWindow({
    windowDays: parsedWindow,
    cardCount: scopeCount,
  });
  const cardsPerDay = postponeCardsPerDay({
    cardCount: scopeCount,
    windowDays,
  });

  // Switching scope changes the count, which can drop the ceiling below what's
  // currently typed -- re-clamp rather than silently postponing out of range.
  const handleScopeChange = (value: string) => {
    const nextScope = value as PostponeScope;
    const nextCount =
      (nextScope === "all" ? counts?.total : counts?.backlog) ?? 0;

    setPostponeScope(nextScope);
    setWindowInput((current) =>
      String(
        clampPostponeWindow({
          windowDays: Number(current),
          cardCount: nextCount,
        })
      )
    );
  };

  // Animate the bar width so each batch jump (up to CHUNK_SIZE cards at once)
  // eases to its new position instead of snapping.
  const postponeProgressWidth = useSharedValue(0);
  const postponeProgressBarStyle = useAnimatedStyle(() => ({
    width: `${postponeProgressWidth.value}%`,
  }));

  useEffect(() => {
    if (!postponeProgress || postponeProgress.total === 0) {
      postponeProgressWidth.value = 0;
      return;
    }
    postponeProgressWidth.value = withTiming(
      (postponeProgress.postponed / postponeProgress.total) * 100,
      { duration: 250 }
    );
  }, [postponeProgress, postponeProgressWidth]);

  const handlePostpone = async () => {
    try {
      let lastProgress = { postponed: 0, total: 0 };
      let lastPaintAt = 0;

      // The whole drain has to sit inside one queue slot. postpone holds its
      // transaction open across every yield, and the repaint yield below hands
      // control back to the event loop between chunks -- long enough for the
      // periodic sync (which shares this single-slot queue) to start a
      // pull/push against a connection with an open transaction.
      await enqueueDbOperation(async () => {
        for await (const progress of flashcardsTable.postpone.generator({
          scope: postponeScope,
          windowDays,
        })) {
          lastProgress = progress;

          // The generator drains as a tight chain of awaited DB writes, which
          // only yields microtasks -- RN never gets a frame to repaint, so the
          // progress bar would stay invisible until the loop ends. Hand control
          // back to the event loop (throttled to ~20fps) so it actually renders.
          const now = Date.now();
          if (
            now - lastPaintAt > 200 ||
            progress.postponed === progress.total
          ) {
            setPostponeProgress(progress);
            lastPaintAt = now;
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
      });

      // Rescheduling touches every overdue card, so push it now rather than
      // leaving the change set to sit until the next periodic sync -- web
      // pushes immediately and the two shouldn't disagree for a minute.
      if (lastProgress.total > 0) {
        await performSync();
      }

      queryClient.invalidateQueries({
        queryKey: flashcardsTable.today.cacheOptions.queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: flashcardsTable.counts.cacheOptions.queryKey,
      });

      if (lastProgress.total === 0) {
        toast.info(t`No overdue cards to reschedule.`);
      } else {
        toast.success(t`Backlog rescheduled!`, {
          description: t`${lastProgress.postponed} cards have been spread over the next ${windowDays} days.`,
        });
      }
    } catch (err) {
      // A failed postpone rolls back, so without this the only trace is a
      // toast the user dismisses.
      Sentry.captureException(err, {
        tags: { operation: "postpone" },
      });
      toast.error(t`Failed to reschedule backlog`, {
        description: t`There was an error rescheduling your backlog.`,
      });
    } finally {
      setPostponeProgress(null);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t`Delete Account`,
      t`This will permanently delete your account, all your dictionary entries, flashcards, decks, and any active subscription. This action cannot be undone.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete Account`,
          style: "destructive",
          onPress: async () => {
            const { error } = await authClient.deleteUser({});

            if (error) {
              console.error("Failed to delete account:", error);
              if (error.message === authClient.$ERROR_CODES.SESSION_EXPIRED) {
                toast.error(t`Please sign in again to delete your account`);
                return;
              }
              toast.error(t`Failed to delete account`);
              return;
            }

            try {
              await resetDb();
              deleteLocalDb();
              resetOramaDb();
            } catch (err) {
              console.error("Failed to clear local data:", err);
            }

            await reloadAppAsync("Account deleted");
          },
        },
      ]
    );
  };

  const handleDeleteDictionary = () => {
    Alert.alert(
      t`Delete Dictionary`,
      t`This will permanently delete all your words, flashcards, and decks. This action cannot be undone.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Delete Everything`,
          style: "destructive",
          onPress: async () => {
            try {
              await ensureDb();
              const drizzleDb = getDrizzleDb();

              // Delete flashcards before dictionary entries (flashcards
              // reference entries). Manual BEGIN/COMMIT mirrors the shared
              // postpone op -- the mobile adapter's drizzle instance is
              // driven through raw run() rather than .transaction().
              await drizzleDb.run(sql`BEGIN TRANSACTION`);
              try {
                await drizzleDb.delete(flashcards);
                await drizzleDb.delete(dictionaryEntries);
                await drizzleDb.delete(decks);
                await drizzleDb.run(sql`COMMIT`);
              } catch (err) {
                await drizzleDb.run(sql`ROLLBACK`);
                throw err;
              }

              // Revlogs live in the central API DB, not the local replica.
              await api.stats.revlogs.delete();

              // Push the local deletions to the remote so they actually
              // persist, then rebuild the (now empty) search index.
              const db = await ensureDb();
              await db.push?.();

              // Rebuild the (now empty) search index, then reset the search
              // atom so the dictionary list re-queries it -- the list is
              // Jotai-backed, not React Query, so invalidateQueries alone won't
              // refresh it.
              resetOramaDb();
              resetSearch();

              queryClient.invalidateQueries();

              toast.success(t`Dictionary deleted`);
            } catch (error) {
              console.error("Failed to delete dictionary:", error);
              toast.error(t`Failed to delete dictionary`);
            }
          },
        },
      ]
    );
  };

  const antonymOptions = [
    { value: "hidden", label: t`Hidden` },
    { value: "hint", label: t`Hint` },
    { value: "answer", label: t`Answer` },
  ];

  const postponeScopeOptions = [
    {
      value: "all",
      label: t`All overdue (${formatNumber(counts?.total ?? 0)})`,
    },
    {
      value: "backlog",
      label: t`Backlog only (${formatNumber(counts?.backlog ?? 0)})`,
    },
  ];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Animated.ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="pb-safe-offset-6"
      onScroll={scrollHandler}
      scrollEventThrottle={16}
    >
      <ScreenHeader icon={Settings} title={t`Settings`} />

      <View className="gap-4 px-4 pt-4">
        {/* Appearance */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Palette color={colors.mutedForeground} size={18} />
              <CardTitle>
                <Trans>Appearance</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <SettingRow
              description={t`Follows your system settings`}
              title={t`Theme`}
            >
              <Text className="text-muted-foreground text-sm capitalize">
                {colorScheme === "dark" ? t`Dark` : t`Light`}
              </Text>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Languages color={colors.mutedForeground} size={18} />
              <CardTitle>
                <Trans>Language</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <SettingRow
              description={t`Follows your device language`}
              title={t`App language`}
            >
              <Text className="text-muted-foreground text-sm">
                <Trans>System</Trans>
              </Text>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Import / Export */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <FolderSync color={colors.mutedForeground} size={18} />
              <CardTitle>
                <Trans>Import / Export</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <Text className="mb-4 text-muted-foreground text-sm">
              <Trans>
                Importing and exporting your dictionary is not available on
                mobile. Please use the web app to manage your data.
              </Trans>
            </Text>
            <Button
              Icon={ExternalLink}
              onPress={() =>
                Linking.openURL("https://bahar.dev/settings#dictionary")
              }
              variant="outline"
            >
              <Trans>Open Web App</Trans>
            </Button>
          </CardContent>
        </Card>

        {/* Billing */}
        <BillingCard />

        {/* Preferences */}
        <NotificationsCard />

        {/* Flashcard Settings */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Brain color={colors.mutedForeground} size={18} />
              <CardTitle>
                <Trans>Flashcards</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <View className="gap-1">
              <SettingRow
                description={t`New words get an English to Arabic reverse card. You can still turn reverse on or off per word.`}
                title={t`Create reverse cards by default`}
              >
                <Controller
                  control={control}
                  name="create_reverse_by_default"
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      onValueChange={(newValue) => {
                        onChange(newValue);
                        updateMutation.mutate({
                          updates: { create_reverse_by_default: newValue },
                        });
                      }}
                      thumbColor="white"
                      trackColor={{ false: colors.muted, true: colors.primary }}
                      value={value}
                    />
                  )}
                />
              </SettingRow>

              <View className="my-2 border-border/50 border-t" />

              <View className="py-2">
                <Text className="mb-1 font-medium text-base text-foreground">
                  <Trans>Show antonyms</Trans>
                </Text>
                <Text className="mb-3 text-muted-foreground text-sm">
                  <Trans>Control where antonyms appear during review</Trans>
                </Text>
                <Controller
                  control={control}
                  name="show_antonyms_in_flashcard"
                  render={({ field: { value, onChange } }) => (
                    <SelectOptions
                      onChange={(newValue) => {
                        onChange(newValue);
                        updateMutation.mutate({
                          updates: {
                            show_antonyms_in_flashcard:
                              newValue as ShowAntonymsMode,
                          },
                        });
                      }}
                      options={antonymOptions}
                      value={value}
                    />
                  )}
                />
              </View>

              <View className="my-2 border-border/50 border-t" />

              <View className="py-2">
                <Text className="mb-1 font-medium text-base text-foreground">
                  <Trans>Reschedule backlog</Trans>
                </Text>
                <Text className="mb-3 text-muted-foreground text-sm">
                  {postponeScope === "all" ? (
                    <Trans>
                      Spread your overdue cards evenly across the days ahead.
                      Your progress on each card is untouched.
                    </Trans>
                  ) : (
                    <Trans>
                      Spread your backlog cards evenly across the days ahead.
                      Cards overdue by less than{" "}
                      {DEFAULT_BACKLOG_THRESHOLD_DAYS} days stay due today. Your
                      progress on each card is untouched.
                    </Trans>
                  )}
                </Text>

                <View className="mb-3">
                  <SelectOptions
                    onChange={handleScopeChange}
                    options={postponeScopeOptions}
                    value={postponeScope}
                  />
                </View>

                <View className="mb-3">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground text-sm">
                      <Trans>Spread over</Trans>
                    </Text>
                    <Input
                      className="w-20"
                      editable={!hasNothingToPostpone}
                      keyboardType="number-pad"
                      onChangeText={setWindowInput}
                      value={windowInput}
                    />
                    <Text className="text-muted-foreground text-sm">
                      <Trans>days</Trans>
                    </Text>
                  </View>

                  {/* "14 days" means nothing to someone deciding; "53 cards a
                      day" is the number they can actually say yes or no to. */}
                  {!hasNothingToPostpone && isWindowValid && (
                    <Text className="mt-1.5 text-muted-foreground text-xs">
                      <Trans>
                        about {formatNumber(cardsPerDay)} cards per day
                      </Trans>
                    </Text>
                  )}
                </View>

                {postponeProgress ? (
                  <View className="gap-2">
                    <View className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <Animated.View
                        className="h-full rounded-full bg-primary"
                        style={postponeProgressBarStyle}
                      />
                    </View>
                    <Text className="text-center text-muted-foreground text-xs">
                      <Trans>
                        {postponeProgress.postponed} / {postponeProgress.total}{" "}
                        cards
                      </Trans>
                    </Text>
                  </View>
                ) : (
                  <View className="gap-1.5">
                    <Button
                      disabled={hasNothingToPostpone || !isWindowValid}
                      onPress={handlePostpone}
                      variant="outline"
                    >
                      <Trans>Reschedule</Trans>
                    </Button>

                    {/* No hover on touch, so the reason a disabled button is
                        disabled has to be stated inline rather than in a
                        tooltip like web. */}
                    {hasNothingToPostpone && (
                      <Text className="text-center text-muted-foreground text-xs">
                        {postponeScope === "all" ? (
                          <Trans>
                            You have no overdue cards to reschedule.
                          </Trans>
                        ) : (
                          <Trans>
                            You have no backlog cards to reschedule.
                          </Trans>
                        )}
                      </Text>
                    )}
                  </View>
                )}
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Trash2 color={colors.destructive} size={18} />
              <CardTitle>
                <Trans>Danger Zone</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <View className="gap-6">
              <View>
                <Text className="mb-4 text-muted-foreground text-sm">
                  <Trans>
                    Permanently delete all your data including words,
                    flashcards, and decks.
                  </Trans>
                </Text>
                <Button onPress={handleDeleteDictionary} variant="destructive">
                  <Trans>Delete All Data</Trans>
                </Button>
              </View>

              <View className="border-border/50 border-t" />

              <View>
                <Text className="mb-4 text-muted-foreground text-sm">
                  <Trans>
                    Permanently delete your Bahar account, including your
                    subscription and all data.
                  </Trans>
                </Text>
                <Button onPress={handleDeleteAccount} variant="destructive">
                  <Trans>Delete Account</Trans>
                </Button>
              </View>
            </View>
          </CardContent>
        </Card>
      </View>
    </Animated.ScrollView>
  );
}
