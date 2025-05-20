import { Page } from "@/components/Page";
import { OtpInput } from "react-native-otp-entry";
import { useColorScheme, Text } from "react-native";
import { cssVariables } from "@bahar/design-system/theme";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/button";
import { authClient } from "@/utils/auth-client";
import { useState } from "react";

export default function EnterCodeScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputtedCode, setInputtedCode] = useState("");
  const colorScheme = useColorScheme();
  const local = useLocalSearchParams<{ email: string }>();

  const colors =
    colorScheme === "dark" ? cssVariables.dark : cssVariables.light;

  const onSubmit = async (code: string) => {
    setIsSubmitting(true);

    try {
      const { error } = await authClient.signIn.emailOtp({
        email: local.email,
        otp: code,
      });

      if (error) {
        console.error("Invalid OTP: ", error);

        setError(t`That code is invalid.`);
      }
    } catch (err) {
      setError(t`Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Page className="!bg-background">
      <Text className="tracking-tight font-bold text-xl text-foreground text-center">
        <Trans>Enter your 6-digit code from your email</Trans>
      </Text>

      <OtpInput
        numberOfDigits={6}
        disabled={isSubmitting}
        focusColor={`hsl(${colors["--primary"]})`}
        theme={{
          pinCodeTextStyle: {
            color: `hsl(${colors["--foreground"]})`,
          },
        }}
        onTextChange={(text) => {
          setInputtedCode(text);
        }}
        onFilled={onSubmit}
      />

      {error && (
        <Text className="font-medium text-destructive">
          <Trans>That code is invalid.</Trans>
        </Text>
      )}

      <Button
        onPress={async () => {
          await onSubmit(inputtedCode);
        }}
        disabled={isSubmitting}
        className="w-full"
      >
        <Trans>Continue</Trans>
      </Button>
    </Page>
  );
}
