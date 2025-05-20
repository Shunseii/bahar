import { View, Text } from "react-native";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { Button } from "@/components/ui/button";

import { Page } from "@/components/Page";
import { Input } from "@/components/ui/input";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import z from "zod";
import { authClient } from "@/utils/auth-client";
import { useRouter } from "expo-router";

const LoginFormSchema = z.object({
  email: z.string().email().min(5).max(256),
});

export default function LoginScreen() {
  const router = useRouter();

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit: SubmitHandler<z.infer<typeof LoginFormSchema>> = async ({
    email,
  }) => {
    const lowerCaseEmail = email.toLowerCase();

    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: lowerCaseEmail,
      type: "sign-in",
    });

    if (error) {
      console.error("There was an error sending the OTP: ", error);

      setError("root", {
        message: t`Please try again.`,
      });

      return;
    }

    router.push(`/code/${lowerCaseEmail}`);
  };

  return (
    <Page className="!bg-background">
      <Text className="tracking-tight font-bold text-2xl text-foreground text-center">
        <Trans>Welcome to Bahar!</Trans>
      </Text>

      <Text className="text-muted-foreground mt-2 text-center text-sm">
        <Trans>Log in to your existing account or sign up for a new one</Trans>
      </Text>

      <View className="w-full gap-y-2 mb-6">
        <Text className="flex flex-col gap-y-4 w-full text-foreground">
          <Trans>Email</Trans>
        </Text>

        <Controller
          control={control}
          rules={{
            required: true,
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          )}
          name="email"
        />
        {errors.email && (
          <Text className="font-medium text-destructive">
            <Trans>This field is required.</Trans>
          </Text>
        )}

        <Text className="text-sm text-muted-foreground">
          <Trans>This is case insensitive.</Trans>
        </Text>
      </View>

      {!!errors.root?.message && (
        <Text className="font-medium text-destructive">
          {errors.root?.message}
        </Text>
      )}

      <Button disabled={isSubmitting} onPress={handleSubmit(onSubmit)}>
        <Trans>Continue with Email</Trans>
      </Button>

      <View className="flex-row items-center my-6">
        <View className="flex-1 h-[1px] bg-gray-300 dark:bg-gray-700" />
        <Text className="mx-4 text-sm text-gray-500 dark:text-gray-400">
          <Trans>Or continue with</Trans>
        </Text>
        <View className="flex-1 h-[1px] bg-gray-300 dark:bg-gray-700" />
      </View>

      <GithubLoginButton />
    </Page>
  );
}
