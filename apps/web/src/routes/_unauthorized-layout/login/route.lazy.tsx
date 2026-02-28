import { Button } from "@bahar/web-ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bahar/web-ui/components/form";
import { Input } from "@bahar/web-ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import z from "zod";
import { showOTPFormAtom } from "@/atoms/otp";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import { OTPForm } from "@/components/OTPForm";
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
    const definedRedirect = redirect ?? "/";

    const [to, hash] = definedRedirect.split("#");

    return (
      <Form {...form}>
        <OTPForm
          onVerifyOTP={() => {
            navigate({
              to,
              hash,
              replace: true,
              resetScroll: true,
            });
          }}
        />
      </Form>
    );
  }

  return (
    <Page className="mx-auto flex max-w-96 flex-col items-center justify-center gap-y-6">
      <div className="mt-8 flex flex-col gap-y-2 md:mt-0">
        <h1 className="text-center font-bold text-2xl text-foreground tracking-tight">
          <Trans>Welcome to Bahar!</Trans>
        </h1>

        <p className="mt-2 text-muted-foreground text-sm">
          <Trans>
            Log in to your existing account or sign up for a new one
          </Trans>
        </p>
      </div>

      <Form {...form}>
        <form
          className="flex w-full flex-col items-center gap-y-6"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="flex w-full flex-col gap-y-4">
            <FormField
              control={form.control}
              name="email"
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

          <p className="font-medium text-destructive ltr:text-sm rtl:text-base">
            {form.formState.errors.root?.message}
          </p>

          <Button
            className="w-full"
            disabled={form.formState.isSubmitting}
            type="submit"
          >
            <Trans>Continue with Email</Trans>
          </Button>
        </form>
      </Form>

      <div className="relative mt-10 w-full">
        <div aria-hidden="true" className="absolute inset-0 flex items-center">
          <div className="w-full border-muted border-t" />
        </div>

        <div className="relative flex justify-center font-medium leading-6 ltr:text-sm rtl:text-base">
          <span className="bg-background px-6 text-muted-foreground">
            <Trans>Or continue with</Trans>
          </span>
        </div>
      </div>

      <GithubLoginButton>
        <Trans>GitHub</Trans>
      </GithubLoginButton>

      <p className="mt-4 text-center text-muted-foreground text-xs">
        <Trans>
          By signing in, you agree to our{" "}
          <a
            className="underline hover:text-foreground"
            href="https://getbahar.com/privacy"
            rel="noopener noreferrer"
            target="_blank"
          >
            Privacy Policy
          </a>
        </Trans>
      </p>
    </Page>
  );
};

export const Route = createLazyFileRoute("/_unauthorized-layout/login")({
  component: Login,
});
