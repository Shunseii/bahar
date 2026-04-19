import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform, Pressable, Text, useColorScheme, View } from "react-native";
import { toast } from "sonner-native";
import { useThemeColors } from "@/lib/theme";
import { authClient } from "@/utils/auth-client";

const APPLE_BUTTON_HEIGHT = 40;
const APPLE_BUTTON_CORNER_RADIUS = 6;

const IosAppleButton = () => {
  const colorScheme = useColorScheme();

  const buttonStyle =
    colorScheme === "dark"
      ? AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      : AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE;

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonStyle={buttonStyle}
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      cornerRadius={APPLE_BUTTON_CORNER_RADIUS}
      onPress={async () => {
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (!credential.identityToken) {
            toast.error(t`Apple sign-in failed. Please try again.`);
            return;
          }

          await authClient.signIn.social({
            provider: "apple",
            idToken: { token: credential.identityToken },
          });
        } catch (err) {
          if (
            err instanceof Error &&
            "code" in err &&
            err.code === "ERR_REQUEST_CANCELED"
          ) {
            return;
          }

          console.error("Apple sign-in error:", err);
          toast.error(t`Apple sign-in failed. Please try again.`);
        }
      }}
      style={{ width: "100%", height: APPLE_BUTTON_HEIGHT }}
    />
  );
};

const AndroidAppleButton = () => {
  const { foreground } = useThemeColors();

  return (
    <Pressable
      onPress={() => {
        authClient.signIn.social({ provider: "apple", callbackURL: "/" });
      }}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View className="flex h-10 w-full flex-row items-center justify-center gap-x-2 rounded-md border border-black bg-white px-4 py-2 transition-colors disabled:opacity-50 dark:border-0 dark:bg-black">
        <FontAwesome5 color={foreground} name="apple" size={18} />

        <Text className="font-medium text-foreground">
          <Trans>Continue with Apple</Trans>
        </Text>
      </View>
    </Pressable>
  );
};

export const AppleLoginButton = () => {
  if (Platform.OS === "ios") {
    return <IosAppleButton />;
  }

  return <AndroidAppleButton />;
};
