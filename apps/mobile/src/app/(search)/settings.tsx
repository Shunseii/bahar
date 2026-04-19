import type { ShowAntonymsMode } from "@bahar/drizzle-user-db-schemas";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import Animated from "react-native-reanimated";
import { toast } from "sonner-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScreenHeader } from "@/components/ui/screen-header";
import { useCollapsibleHeader } from "@/hooks/useCollapsibleHeader";
import { useUserPlan } from "@/hooks/useUserPlan";
import { deleteLocalDb, resetDb } from "@/lib/db";
import { settingsTable, type UserSettings } from "@/lib/db/operations/settings";
import { resetOramaDb } from "@/lib/search";
import { useThemeColors } from "@/lib/theme";
import { api, queryClient } from "@/utils/api";
import { authClient } from "@/utils/auth-client";

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

const PreferencesCard = () => {
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
            <Trans>Preferences</Trans>
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
  const { scrollHandler } = useCollapsibleHeader(t`Settings`);

  const { data: settings, isLoading } = useQuery({
    queryFn: settingsTable.get.query,
    ...settingsTable.get.cacheOptions,
  });

  const { control, reset } = useForm<UserSettings>({
    defaultValues: {
      show_antonyms_mode: "answer",
      show_reverse_flashcards: false,
    },
  });

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: settingsTable.get.cacheOptions.queryKey,
      });
    },
    onError: () => toast.error(t`Failed to update settings`),
  });

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
              await resetDb();
              resetOramaDb();
              toast.success(t`Dictionary deleted`);
              await authClient.signOut();
            } catch (_error) {
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
        <PreferencesCard />

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
                description={t`Include English to Arabic flashcards`}
                title={t`Show reverse flashcards`}
              >
                <Controller
                  control={control}
                  name="show_reverse_flashcards"
                  render={({ field: { value, onChange } }) => (
                    <Switch
                      onValueChange={(newValue) => {
                        onChange(newValue);
                        updateMutation.mutate({
                          updates: { show_reverse_flashcards: newValue },
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
                  name="show_antonyms_mode"
                  render={({ field: { value, onChange } }) => (
                    <SelectOptions
                      onChange={(newValue) => {
                        onChange(newValue);
                        updateMutation.mutate({
                          updates: {
                            show_antonyms_mode: newValue as ShowAntonymsMode,
                          },
                        });
                      }}
                      options={antonymOptions}
                      value={value}
                    />
                  )}
                />
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
