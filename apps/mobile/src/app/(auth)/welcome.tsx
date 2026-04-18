import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { Image, Linking, Text, View } from "react-native";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { authClient } from "@/utils/auth-client";

const PRIVACY_POLICY_URL = "https://getbahar.com/privacy/";

const WelcomeScreen = () => {
  const router = useRouter();
  const { i18n } = useLingui();

  return (
    <Page className="justify-between pb-safe-offset-5">
      <View className="flex-1 items-center justify-center gap-y-4">
        <Image
          resizeMode="contain"
          source={require("@/../assets/images/splash-icon-light.png")}
          style={{ width: 200, height: 200 }}
        />

        <Text className="font-bold text-5xl text-foreground tracking-tight">
          <Trans>بحر</Trans>
        </Text>

        {i18n.locale !== "ar" && (
          <Text className="text-2xl text-muted-foreground">
            <Trans>Bahar</Trans>
          </Text>
        )}

        <Text className="text-center text-base text-muted-foreground">
          <Trans>Your Arabic learning companion</Trans>
        </Text>
      </View>

      <View className="gap-y-3">
        <Button
          onPress={() => {
            authClient.signIn.anonymous();
          }}
          size="lg"
        >
          <Trans>Get Started</Trans>
        </Button>

        <Button
          onPress={() => router.push("/login")}
          size="lg"
          variant="outline"
        >
          <Trans>I already have an account</Trans>
        </Button>

        <Text className="mt-2 text-center text-muted-foreground text-xs">
          <Trans>By continuing, you agree to our</Trans>{" "}
          <Text
            className="text-foreground underline"
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          >
            <Trans>Privacy Policy</Trans>
          </Text>
        </Text>
      </View>
    </Page>
  );
};

export default WelcomeScreen;
