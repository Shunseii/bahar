import React from "react";
import { Text, View, Pressable } from "react-native";
import { Page } from "@/components/Page";
import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { useLocales } from "expo-localization";
import { useColorScheme } from "react-native";
import { cn } from "@bahar/design-system";
import { cssVariables } from "@bahar/design-system/theme";

const Breadcrumbs = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();

  const themeColors =
    colorScheme === "dark" ? cssVariables.dark : cssVariables.light;

  return (
    <View className={cn("mb-8")}>
      <View className="flex flex-row items-center gap-2.5">
        <View className="items-center gap-1.5">
          <Pressable onPress={() => router.push("/")}>
            <Text className="text-sm text-muted-foreground">
              <Trans>Home</Trans>
            </Text>
          </Pressable>
        </View>

        <View className="items-center">
          <ChevronRight
            size={14}
            color={`hsl(${themeColors["--muted-foreground"]})`}
          />
        </View>

        <View className="inline-flex items-center gap-1.5">
          <Text className="text-sm font-normal text-foreground">
            <Trans>Add word</Trans>
          </Text>
        </View>
      </View>
    </View>
  );
};

const BackButton = () => {
  const router = useRouter();
  const locales = useLocales();
  const colorScheme = useColorScheme();
  const dir = locales[0].textDirection;

  return (
    <Button variant="outline" size="icon" onPress={() => router.push("/")}>
      {dir === "rtl" ? (
        <ChevronRight
          size={16}
          color={colorScheme === "dark" ? "white" : "black"}
        />
      ) : (
        <ChevronLeft
          size={16}
          color={colorScheme === "dark" ? "white" : "black"}
        />
      )}
    </Button>
  );
};

export default function AddWordScreen() {
  return (
    <Page className="pt-0 px-4">
      <View className="flex-1 pt-4">
        <Breadcrumbs />

        <View className="max-w-full flex-1">
          <View className="flex-row items-center gap-4 mb-4">
            <BackButton />

            <Text className="text-xl font-semibold text-foreground tracking-tight">
              <Trans>Add a new word to your dictionary</Trans>
            </Text>
          </View>

          {/* TODO: Form sections will be implemented here */}
          <View className="flex-1 justify-center items-center">
            <Text className="text-muted-foreground">
              <Trans>Form sections coming soon...</Trans>
            </Text>
          </View>
        </View>
      </View>
    </Page>
  );
}
