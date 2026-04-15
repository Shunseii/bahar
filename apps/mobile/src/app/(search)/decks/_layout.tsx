import { Stack } from "expo-router";
import { useThemeColors } from "@/lib/theme";

export default function DecksStackLayout() {
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
        name="create"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="edit/[id]"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}
