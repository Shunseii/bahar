/**
 * Settings screen component.
 */

import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from "react-native-reanimated";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Settings,
  Eye,
  Moon,
  Info,
  ChevronRight,
  LogOut,
  Check,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { queryClient } from "../../utils/trpc";
import { settingsTable, type UserSettings } from "../../lib/db/operations/settings";
import type { ShowAntonymsMode } from "@bahar/drizzle-user-db-schemas";

const ANTONYMS_MODES: { value: ShowAntonymsMode; label: string; description: string }[] = [
  { value: "hidden", label: "Hidden", description: "Never show antonyms" },
  { value: "hint", label: "As Hint", description: "Show as a hint before revealing" },
  { value: "answer", label: "With Answer", description: "Show when answer is revealed" },
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
        <Settings size={48} className="text-muted-foreground animate-pulse" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4"
    >
      {/* Header */}
      <Text className="text-foreground text-2xl font-bold mb-6">Settings</Text>

      {/* Flashcard Settings */}
      <Animated.View entering={FadeIn.delay(100).duration(300)}>
        <Text className="text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wide">
          Flashcards
        </Text>
        <View className="bg-card rounded-2xl border border-border/30 overflow-hidden">
          <View className="p-4 border-b border-border/30">
            <View className="flex-row items-center mb-3">
              <Eye size={20} color="#3B82F6" />
              <Text className="text-foreground font-medium ml-2">
                Show Antonyms
              </Text>
            </View>
            <View className="gap-2">
              {ANTONYMS_MODES.map((mode) => (
                <AntonymsModeOption
                  key={mode.value}
                  mode={mode}
                  selected={settings?.show_antonyms_mode === mode.value}
                  onSelect={() => handleAntonymsModeChange(mode.value)}
                />
              ))}
            </View>
          </View>
        </View>
      </Animated.View>

      {/* App Info */}
      <Animated.View entering={FadeIn.delay(200).duration(300)} className="mt-6">
        <Text className="text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wide">
          About
        </Text>
        <View className="bg-card rounded-2xl border border-border/30 overflow-hidden">
          <SettingsRow
            icon={<Info size={20} color="#3B82F6" />}
            label="Version"
            value="1.0.0"
          />
        </View>
      </Animated.View>

      {/* Logout */}
      <Animated.View entering={FadeIn.delay(300).duration(300)} className="mt-6">
        <Pressable
          onPress={handleLogout}
          className="bg-destructive/10 rounded-2xl p-4 flex-row items-center justify-center"
        >
          <LogOut size={20} color="#EF4444" />
          <Text className="text-destructive font-medium ml-2">Log Out</Text>
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
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onSelect}
    >
      <Animated.View
        style={animatedStyle}
        className={`flex-row items-center p-3 rounded-xl ${
          selected ? "bg-primary/10" : "bg-muted/30"
        }`}
      >
        <View className="flex-1">
          <Text
            className={`font-medium ${
              selected ? "text-primary" : "text-foreground"
            }`}
          >
            {mode.label}
          </Text>
          <Text className="text-muted-foreground text-sm">{mode.description}</Text>
        </View>
        {selected && <Check size={20} color="#3B82F6" />}
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
      <Text className="text-foreground font-medium ml-3 flex-1">{label}</Text>
      {value && (
        <Text className="text-muted-foreground">{value}</Text>
      )}
      {onPress && <ChevronRight size={20} color="#9CA3AF" className="ml-2" />}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};
