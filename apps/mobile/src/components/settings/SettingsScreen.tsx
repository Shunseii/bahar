/**
 * Settings screen component.
 */

import type { ShowAntonymsMode } from "@bahar/drizzle-user-db-schemas";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import {
  Check,
  ChevronRight,
  Eye,
  Info,
  LogOut,
  Settings,
} from "lucide-react-native";
import type React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { settingsTable } from "../../lib/db/operations/settings";
import { queryClient } from "../../utils/api";

const ANTONYMS_MODES: {
  value: ShowAntonymsMode;
  label: string;
  description: string;
}[] = [
  { value: "hidden", label: "Hidden", description: "Never show antonyms" },
  {
    value: "hint",
    label: "As Hint",
    description: "Show as a hint before revealing",
  },
  {
    value: "answer",
    label: "With Answer",
    description: "Show when answer is revealed",
  },
];

interface SettingsScreenProps {
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const { data: settings, status } = useQuery({
    queryFn: () => settingsTable.get.query(),
    ...settingsTable.get.cacheOptions,
  });

  const { mutateAsync: updateSettings } = useMutation({
    mutationFn: settingsTable.update.mutation,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsTable.get.cacheOptions.queryKey,
      });
    },
  });

  const handleAntonymsModeChange = async (mode: ShowAntonymsMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateSettings({ updates: { show_antonyms_mode: mode } });
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onLogout();
  };

  if (status === "pending") {
    return (
      <View className="flex-1 items-center justify-center">
        <Settings className="animate-pulse text-muted-foreground" size={48} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4"
    >
      {/* Header */}
      <Text className="mb-6 font-bold text-2xl text-foreground">Settings</Text>

      {/* Flashcard Settings */}
      <Animated.View entering={FadeIn.delay(100).duration(300)}>
        <Text className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Flashcards
        </Text>
        <View className="overflow-hidden rounded-2xl border border-border/30 bg-card">
          <View className="border-border/30 border-b p-4">
            <View className="mb-3 flex-row items-center">
              <Eye className="text-primary" size={20} />
              <Text className="ml-2 font-medium text-foreground">
                Show Antonyms
              </Text>
            </View>
            <View className="gap-2">
              {ANTONYMS_MODES.map((mode) => (
                <AntonymsModeOption
                  key={mode.value}
                  mode={mode}
                  onSelect={() => handleAntonymsModeChange(mode.value)}
                  selected={settings?.show_antonyms_mode === mode.value}
                />
              ))}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* App Info */}
      <Animated.View
        className="mt-6"
        entering={FadeIn.delay(200).duration(300)}
      >
        <Text className="mb-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          About
        </Text>
        <View className="overflow-hidden rounded-2xl border border-border/30 bg-card">
          <SettingsRow
            icon={<Info className="text-primary" size={20} />}
            label="Version"
            value="1.0.0"
          />
        </View>
      </Animated.View>

      {/* Logout */}
      <Animated.View
        className="mt-6"
        entering={FadeIn.delay(300).duration(300)}
      >
        <Pressable
          className="flex-row items-center justify-center rounded-2xl bg-destructive/10 p-4"
          onPress={handleLogout}
        >
          <LogOut className="text-destructive" size={20} />
          <Text className="ml-2 font-medium text-destructive">Log Out</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
};

interface AntonymsModeOptionProps {
  mode: { value: ShowAntonymsMode; label: string; description: string };
  selected: boolean;
  onSelect: () => void;
}

const AntonymsModeOption: React.FC<AntonymsModeOptionProps> = ({
  mode,
  selected,
  onSelect,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View
        className={`flex-row items-center rounded-xl p-3 ${
          selected ? "bg-primary/10" : "bg-muted/30"
        }`}
        style={animatedStyle}
      >
        <View className="flex-1">
          <Text
            className={`font-medium ${
              selected ? "text-primary" : "text-foreground"
            }`}
          >
            {mode.label}
          </Text>
          <Text className="text-muted-foreground text-sm">
            {mode.description}
          </Text>
        </View>
        {selected && <Check className="text-primary" size={20} />}
      </Animated.View>
    </Pressable>
  );
};

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  label,
  value,
  onPress,
}) => {
  const content = (
    <View className="flex-row items-center p-4">
      {icon}
      <Text className="ml-3 flex-1 font-medium text-foreground">{label}</Text>
      {value && <Text className="text-muted-foreground">{value}</Text>}
      {onPress && (
        <ChevronRight className="ml-2 text-muted-foreground" size={20} />
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};
