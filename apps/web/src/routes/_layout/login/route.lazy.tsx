import { Link, createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { Trans, t } from "@lingui/macro";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import z from "zod";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OTPForm } from "@/components/OTPForm";
import { trpc } from "@/lib/trpc";
import { useAtom } from "jotai";
import { showOTPFormAtom } from "@/atoms/otp";
import { useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { useEffect } from "react";

const schema = z.object({
  email: z.string().email().min(5).max(256),
});

const translateErrors = (errMsg: string) => {
  if (errMsg === "incorrect_email") {
    return t`That email is incorrect.`;
  } else {
    return "";
  }
};

const Login = () => {
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const { redirect } = Route.useSearch();
  const [showOTPForm, setShowOTPForm] = useAtom(showOTPFormAtom);

  const login = trpc.auth.login.useMutation();
  const validateOTP = trpc.auth.validateLoginOTP.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...getQueryKey(trpc.user.me), { type: "query" }],
      });
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit: SubmitHandler<z.infer<typeof schema>> = async (data) => {
    try {
      const lowerCaseEmail = data.email.toLowerCase();

      await login.mutateAsync({ email: lowerCaseEmail });

      setShowOTPForm(true);
    } catch (err) {
      const error = err as typeof login.error;

      if (error?.message === "incorrect_email") {
        form.setError("email", { message: translateErrors(error.message) });
      } else if (error?.data?.code === "TOO_MANY_REQUESTS") {
        form.setError("root", {
          message: t`Please try again after five minutes.`,
        });
      }

      // TODO: Otherwise, display an error toast
    }
  };

  useEffect(() => {
    setShowOTPForm(false);
  }, []);

  if (showOTPForm) {
    return (
      <OTPForm
        onSubmitForm={async (code) => {
          await validateOTP.mutateAsync({ code });

          navigate({
            to: redirect ?? "/",
            replace: true,
            resetScroll: true,
          });
        }}
      />
    );
  }

  return (
    <>
      <h1 className="tracking-tight font-bold text-2xl dark:text-white text-center text-gray-900">
        <Trans>Log in</Trans>
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
            <Trans>Log in</Trans>
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
        <Trans>Don't have an account?</Trans>
        <Button variant="link" className="p-0" asChild>
          <Link to="/sign-up">
            <Trans>Create one</Trans>
          </Link>
        </Button>
      </p>
    </>
  );
};

export const Route = createLazyFileRoute("/_layout/login")({
  component: Login,
});
