import { Stack } from "expo-router";
import { useThemeColors } from "@/lib/theme";

export default function SettingsStackLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          animation: "slide_from_left",
        }}
      />

      <Stack.Screen
        name="card-appearance"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
