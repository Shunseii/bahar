import React, { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  Switch,
  Pressable,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from "react-native";
import { Trans, useLingui } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useQuery, useMutation } from "@tanstack/react-query";
import { settingsTable, UserSettings } from "@/lib/db/operations/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Palette,
  Languages,
  Brain,
  Trash2,
  ChevronRight,
  Check,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { queryClient } from "@/utils/api";
import { toast } from "sonner-native";
import { useThemeColors } from "@/lib/theme";
import { ShowAntonymsMode } from "@bahar/drizzle-user-db-schemas";
import { resetOramaDb } from "@/lib/search";
import { resetDb } from "@/lib/db";
import { authClient } from "@/utils/auth-client";

interface SettingRowProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ title, description, children }) => (
  <View className="flex-row items-center justify-between py-3">
    <View className="flex-1 mr-4">
      <Text className="text-base font-medium text-foreground">{title}</Text>
      {description && (
        <Text className="text-sm text-muted-foreground mt-0.5">{description}</Text>
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

const SelectOptions: React.FC<SelectOptionProps> = ({ options, value, onChange }) => {
  const colorScheme = useColorScheme();

  return (
    <View className="flex-row gap-2">
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          className={`px-3 py-2 rounded-md border ${
            value === option.value
              ? "border-primary bg-primary/10"
              : "border-border bg-background"
          }`}
        >
          <Text
            className={`text-sm ${
              value === option.value ? "text-primary font-medium" : "text-foreground"
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
      queryClient.invalidateQueries({ queryKey: settingsTable.get.cacheOptions.queryKey });
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
      ],
    );
  };

  const antonymOptions = [
    { value: "hidden", label: translate`Hidden` },
    { value: "hint", label: translate`Hint` },
    { value: "answer", label: translate`Answer` },
  ];

  if (isLoading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
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
      <View className="px-4 py-4 border-b border-border">
        <View className="flex-row items-center gap-3">
          <View className="p-2 rounded-xl bg-primary/10">
            <Settings size={24} color={colors.primary} />
          </View>
          <Text className="text-2xl font-bold text-foreground">
            <Trans>Settings</Trans>
          </Text>
        </View>
      </View>

      <View className="px-4 pt-4 gap-4">
        {/* Flashcard Settings */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Brain size={18} color={colors.mutedForeground} />
              <CardTitle>
                <Trans>Flashcards</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <View className="gap-1">
              <SettingRow
                title={translate`Show reverse flashcards`}
                description={translate`Include English to Arabic flashcards`}
              >
                <Switch
                  value={settings?.show_reverse_flashcards ?? false}
                  onValueChange={(value) =>
                    handleUpdateSetting({ show_reverse_flashcards: value })
                  }
                  trackColor={{ false: colors.muted, true: colors.primary }}
                  thumbColor="white"
                />
              </SettingRow>

              <View className="border-t border-border/50 my-2" />

              <View className="py-2">
                <Text className="text-base font-medium text-foreground mb-1">
                  <Trans>Show antonyms</Trans>
                </Text>
                <Text className="text-sm text-muted-foreground mb-3">
                  <Trans>Control where antonyms appear during review</Trans>
                </Text>
                <SelectOptions
                  options={antonymOptions}
                  value={settings?.show_antonyms_mode ?? "answer"}
                  onChange={(value) =>
                    handleUpdateSetting({ show_antonyms_mode: value as ShowAntonymsMode })
                  }
                />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Palette size={18} color={colors.mutedForeground} />
              <CardTitle>
                <Trans>Appearance</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <SettingRow
              title={translate`Theme`}
              description={translate`Follows your system settings`}
            >
              <Text className="text-sm text-muted-foreground capitalize">
                {colorScheme === "dark" ? translate`Dark` : translate`Light`}
              </Text>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Languages size={18} color={colors.mutedForeground} />
              <CardTitle>
                <Trans>Language</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <SettingRow
              title={translate`App language`}
              description={translate`Follows your device language`}
            >
              <Text className="text-sm text-muted-foreground">
                <Trans>System</Trans>
              </Text>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/30">
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Trash2 size={18} color={colors.destructive} />
              <CardTitle>
                <Trans>Danger Zone</Trans>
              </CardTitle>
            </View>
          </CardHeader>
          <CardContent>
            <Text className="text-sm text-muted-foreground mb-4">
              <Trans>
                Permanently delete all your data including words, flashcards, and decks.
              </Trans>
            </Text>
            <Button variant="destructive" onPress={handleDeleteDictionary}>
              <Trans>Delete All Data</Trans>
            </Button>
          </CardContent>
        </Card>
      </View>
    </ScrollView>
  );
}
