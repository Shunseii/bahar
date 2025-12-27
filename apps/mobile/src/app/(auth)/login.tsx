import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useRouter } from "expo-router";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import z from "zod";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/utils/auth-client";

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
      <Text className="text-center font-bold text-2xl text-foreground tracking-tight">
        <Trans>Welcome to Bahar!</Trans>
      </Text>

      <Text className="mt-2 text-center text-muted-foreground text-sm">
        <Trans>Log in to your existing account or sign up for a new one</Trans>
      </Text>

      <View className="mb-6 w-full gap-y-2">
        <Text className="flex w-full flex-col gap-y-4 text-foreground">
          <Trans>Email</Trans>
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              autoCapitalize="none"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
          rules={{
            required: true,
          }}
        />
        {errors.email && (
          <Text className="font-medium text-destructive">
            <Trans>This field is required.</Trans>
          </Text>
        )}

        <Text className="text-muted-foreground text-sm">
          <Trans>This is case insensitive.</Trans>
        </Text>
      </View>

      {!!errors.root?.message && (
        <Text className="font-medium text-destructive">
          {errors.root?.message}
        </Text>
      )}

      <Button disabled={isSubmitting} onPress={() => handleSubmit(onSubmit)()}>
        <Trans>Continue with Email</Trans>
      </Button>

      <View className="my-6 flex-row items-center">
        <View className="h-[1px] flex-1 bg-gray-300 dark:bg-gray-700" />
        <Text className="mx-4 text-gray-500 text-sm dark:text-gray-400">
          <Trans>Or continue with</Trans>
        </Text>
        <View className="h-[1px] flex-1 bg-gray-300 dark:bg-gray-700" />
      </View>

      <GithubLoginButton />
    </Page>
  );
}
