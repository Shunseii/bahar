import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import z from "zod";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OTPForm } from "@/components/OTPForm";
import { useAtom } from "jotai";
import { showOTPFormAtom } from "@/atoms/otp";
import { useEffect } from "react";
import { Page } from "@/components/Page";
import { authClient } from "@/lib/auth-client";

export const LoginFormSchema = z.object({
  email: z.string().email().min(5).max(256),
});

const Login = () => {
  const navigate = useNavigate({ from: "/" });
  const { redirect } = Route.useSearch();
  const [showOTPForm, setShowOTPForm] = useAtom(showOTPFormAtom);

  const form = useForm<z.infer<typeof LoginFormSchema>>({
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

      form.setError("root", {
        message: t`Please try again.`,
      });

      return;
    }

    setShowOTPForm(true);
  };

  useEffect(() => {
    setShowOTPForm(false);
  }, []);

  if (showOTPForm) {
    return (
      <Form {...form}>
        <OTPForm
          onVerifyOTP={() => {
            navigate({
              to: redirect ?? "/",
              replace: true,
              resetScroll: true,
            });
          }}
        />
      </Form>
    );
  }

  return (
    <Page className="flex flex-col justify-center items-center gap-y-6 mx-auto max-w-96">
      <div className="flex flex-col gap-y-2 mt-8 md:mt-0">
        <h1 className="tracking-tight font-bold text-2xl dark:text-white text-center text-gray-900">
          <Trans>Welcome to Bahar!</Trans>
        </h1>

        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
          <Trans>
            Log in to your existing account or sign up for a new one
          </Trans>
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-y-6 items-center w-full"
        >
          <div className="flex flex-col gap-y-4 w-full">
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Email</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input {...field} />
                  </FormControl>

                  <FormDescription>
                    <Trans>This is case insensitive.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <p className="ltr:text-sm rtl:text-base font-medium text-destructive">
            {form.formState.errors.root?.message}
          </p>

          <Button
            disabled={form.formState.isSubmitting}
            type="submit"
            className="w-full"
          >
            <Trans>Continue with Email</Trans>
          </Button>
        </form>
      </Form>

      <div className="relative mt-10 w-full">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-muted" />
        </div>

        <div className="relative flex justify-center ltr:text-sm rtl:text-base font-medium leading-6">
          <span className="bg-background px-6 text-muted-foreground">
            <Trans>Or continue with</Trans>
          </span>
        </div>
      </div>

      <GithubLoginButton>
        <Trans>GitHub</Trans>
      </GithubLoginButton>
    </Page>
  );
};

export const Route = createLazyFileRoute("/_layout/login")({
  component: Login,
});
