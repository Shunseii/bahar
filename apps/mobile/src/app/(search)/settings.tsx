import type { ShowAntonymsMode } from "@bahar/drizzle-user-db-schemas";
import { t } from "@lingui/core/macro";
import { Trans, useLingui } from "@lingui/react/macro";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Brain,
  Languages,
  Palette,
  Settings,
  Trash2,
} from "lucide-react-native";
import type React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resetDb } from "@/lib/db";
import { settingsTable, type UserSettings } from "@/lib/db/operations/settings";
import { resetOramaDb } from "@/lib/search";
import { useThemeColors } from "@/lib/theme";
import { queryClient } from "@/utils/api";
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
  const colorScheme = useColorScheme();

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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const { t: translate } = useLingui();

  const { data: settings, isLoading } = useQuery({
    queryFn: settingsTable.get.query,
    ...settingsTable.get.cacheOptions,
  });

  const updateMutation = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsTable.get.cacheOptions.queryKey,
      });
    },
    onError: () => toast.error(t`Failed to update settings`),
  });

  const handleUpdateSetting = (updates: Partial<UserSettings>) => {
    updateMutation.mutate({ updates });
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
              // Reset local database and search index
              await resetDb();
              resetOramaDb();
              toast.success(t`Dictionary deleted`);
              // Sign out to force fresh start
              await authClient.signOut();
            } catch (error) {
              toast.error(t`Failed to delete dictionary`);
            }
          },
        },
      ]
    );
  };

  const antonymOptions = [
    { value: "hidden", label: translate`Hidden` },
    { value: "hint", label: translate`Hint` },
    { value: "answer", label: translate`Answer` },
  ];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      {/* Header */}
      <View className="border-border border-b px-4 py-4">
        <View className="flex-row items-center gap-3">
          <View className="rounded-xl bg-primary/10 p-2">
            <Settings color={colors.primary} size={24} />
          </View>
          <Text className="font-bold text-2xl text-foreground">
            <Trans>Settings</Trans>
          </Text>
        </View>
      </View>

      <View className="gap-4 px-4 pt-4">
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
                description={translate`Include English to Arabic flashcards`}
                title={translate`Show reverse flashcards`}
              >
                <Switch
                  onValueChange={(value) =>
                    handleUpdateSetting({ show_reverse_flashcards: value })
                  }
                  thumbColor="white"
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  value={settings?.show_reverse_flashcards ?? false}
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
                <SelectOptions
                  onChange={(value) =>
                    handleUpdateSetting({
                      show_antonyms_mode: value as ShowAntonymsMode,
                    })
                  }
                  options={antonymOptions}
                  value={settings?.show_antonyms_mode ?? "answer"}
                />
              </View>
            </View>
          </CardContent>
        </Card>

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
              description={translate`Follows your system settings`}
              title={translate`Theme`}
            >
              <Text className="text-muted-foreground text-sm capitalize">
                {colorScheme === "dark" ? translate`Dark` : translate`Light`}
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
              description={translate`Follows your device language`}
              title={translate`App language`}
            >
              <Text className="text-muted-foreground text-sm">
                <Trans>System</Trans>
              </Text>
            </SettingRow>
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
            <Text className="mb-4 text-muted-foreground text-sm">
              <Trans>
                Permanently delete all your data including words, flashcards,
                and decks.
              </Trans>
            </Text>
            <Button onPress={handleDeleteDictionary} variant="destructive">
              <Trans>Delete All Data</Trans>
            </Button>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
