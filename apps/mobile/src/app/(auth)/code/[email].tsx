import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { OtpInput } from "react-native-otp-entry";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { authClient } from "@/utils/auth-client";

export default function EnterCodeScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inputtedCode, setInputtedCode] = useState("");
  const local = useLocalSearchParams<{ email: string }>();

  const primaryColor = useCSSVariable("--color-primary");
  const foregroundColor = useCSSVariable("--color-foreground");

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
      <Text className="text-center font-bold text-foreground text-xl tracking-tight">
        <Trans>Enter your 6-digit code from your email</Trans>
      </Text>

      <OtpInput
        disabled={isSubmitting}
        focusColor={primaryColor}
        numberOfDigits={6}
        onFilled={onSubmit}
        onTextChange={(text) => {
          setInputtedCode(text);
        }}
        theme={{
          pinCodeTextStyle: {
            color: foregroundColor,
          },
        }}
      />

      {error && (
        <Text className="font-medium text-destructive">
          <Trans>That code is invalid.</Trans>
        </Text>
      )}

      <Button
        className="w-full"
        disabled={isSubmitting}
        onPress={async () => {
          await onSubmit(inputtedCode);
        }}
      >
        <Trans>Continue</Trans>
      </Button>
    </Page>
  );
}
