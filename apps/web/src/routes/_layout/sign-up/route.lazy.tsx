import { Button } from "@/components/ui/button";
import { Trans, t } from "@lingui/macro";
import { createLazyFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { trpc } from "@/lib/trpc";
import { z } from "@/zod";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { OTPForm } from "@/components/OTPForm";
import { useAtom } from "jotai";
import { showOTPFormAtom } from "@/atoms/otp";

const schema = z.object({
  email: z.string().email().min(5).max(256),
  username: z.string(),
});

const translateErrors = (errMsg: string) => {
  if (errMsg === "email_in_use") {
    return t`That email already exists.`;
  } else {
    return "";
  }
};

const SignUp = () => {
  const signUp = trpc.auth.signUp.useMutation();
  const validateOTP = trpc.auth.validateOTP.useMutation();
  const { redirect } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [showOTPForm, setShowOTPForm] = useAtom(showOTPFormAtom);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      username: "",
      email: "",
    },
  });

  const onSubmit: SubmitHandler<z.infer<typeof schema>> = async (data) => {
    try {
      const lowerCaseEmail = data.email.toLowerCase();

      await signUp.mutateAsync({
        username: data.username,
        email: lowerCaseEmail,
      });

      setShowOTPForm(true);
      return;
    } catch (err) {
      const error = err as typeof signUp.error;

      if (error?.message === "email_in_use") {
        form.setError("email", { message: translateErrors(error.message) });
      } else if (error?.data?.code === "TOO_MANY_REQUESTS") {
        form.setError("root", {
          message: t`Please try again after five minutes.`,
        });
      }

      // TODO: Otherwise, display an error toast
    }
  };

  if (showOTPForm) {
    return (
      <OTPForm
        onSubmitForm={async (code) => {
          await validateOTP.mutateAsync({ code });

          setShowOTPForm(false);

          navigate({ to: redirect ?? "/", replace: true, resetScroll: true });
        }}
      />
    );
  }

  return (
    <>
      <h1 className="tracking-tight font-bold text-2xl dark:text-white text-gray-900 text-center">
        <Trans>Create a new account</Trans>
      </h1>

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

            <FormField
              name="username"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <Trans>Username</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input {...field} />
                  </FormControl>

                  <FormDescription>
                    <Trans>This is how we will address you.</Trans>
                  </FormDescription>

                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <p className="text-sm font-medium text-destructive">
            {form.formState.errors.root?.message}
          </p>

          <Button
            disabled={form.formState.isSubmitting}
            type="submit"
            className="w-full"
          >
            <Trans>Create your account</Trans>
          </Button>
        </form>
      </Form>

      <div className="relative mt-10 w-full">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-muted" />
        </div>

        <div className="relative flex justify-center text-sm font-medium leading-6">
          <span className="bg-background px-6 text-muted-foreground">
            <Trans>Or continue with</Trans>
          </span>
        </div>
      </div>

      <GithubLoginButton>
        <Trans>GitHub</Trans>
      </GithubLoginButton>

      <p className="text-center text-sm gap-x-2 text-muted-foreground flex flex-row items-center">
        <Trans>Already have an account?</Trans>
        <Button variant="link" className="p-0" asChild>
          <Link to="/login">
            <Trans>Log in</Trans>
          </Link>
        </Button>
      </p>
    </>
  );
};

export const Route = createLazyFileRoute("/_layout/sign-up")({
  component: SignUp,
});
