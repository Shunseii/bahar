import { cn } from "@bahar/design-system";
import { Button } from "@bahar/web-ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@bahar/web-ui/components/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { OTPInput, type SlotProps } from "input-otp";
import { useSetAtom } from "jotai";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FC } from "react";
import { type SubmitHandler, useForm, useFormContext } from "react-hook-form";
import z from "zod";
import { showOTPFormAtom } from "@/atoms/otp";
import { authClient } from "@/lib/auth-client";
import { getLangDir, type TLocale } from "@/lib/i18n";
import {
  convertArabicNumToEnglish,
  REGEXP_ONLY_EN_AR_DIGITS,
} from "@/lib/utils";
import type { LoginFormSchema } from "@/routes/_unauthorized-layout/login/route.lazy";

const schema = z.object({
  code: z.string().length(6, {
    message: "That code is invalid.",
  }),
});

function Slot(props: SlotProps) {
  return (
    <div
      className={cn(
        "relative h-14 w-10 text-[2rem]",
        "flex items-center justify-center",
        "transition-all duration-300",
        "border-border border-y",
        "ltr:border-r ltr:last:rounded-r-md ltr:first:rounded-l-md ltr:first:border-l",
        "rtl:border-l rtl:last:rounded-l-md rtl:first:rounded-r-md rtl:first:border-r",
        "group-focus-within:border-accent-foreground/20 group-hover:border-accent-foreground/20",
        "outline outline-0 outline-accent-foreground/20",
        { "outline-4 outline-accent-foreground": props.isActive }
      )}
    >
      {props.char !== null && <div>{props.char}</div>}
      {props.hasFakeCaret && <FakeCaret />}
    </div>
  );
}

function FakeCaret() {
  return (
    <div className="pointer-events-none absolute inset-0 flex animate-caret-blink items-center justify-center">
      <div className="h-8 w-px bg-white" />
    </div>
  );
}

function FakeDash() {
  return (
    <div className="flex w-10 items-center justify-center">
      <div className="h-1 w-3 rounded-full bg-border" />
    </div>
  );
}

export const OTPForm: FC<{
  /**
   * This function is called after the OTP has been
   * successfully verified.
   */
  onVerifyOTP: () => void;
}> = ({ onVerifyOTP }) => {
  const setShowOTPForm = useSetAtom(showOTPFormAtom);
  const { i18n } = useLingui();

  const loginForm = useFormContext<z.infer<typeof LoginFormSchema>>();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    reValidateMode: "onSubmit",
    defaultValues: {
      code: "",
    },
  });

  const dir = getLangDir(i18n.locale as TLocale);
  const email = loginForm.watch("email");

  const onSubmit: SubmitHandler<z.infer<typeof schema>> = async (data) => {
    try {
      const normalizedCode = convertArabicNumToEnglish(data.code);

      const { error } = await authClient.signIn.emailOtp({
        email,
        otp: normalizedCode,
      });

      if (error) {
        console.error("Invalid OTP: ", error);

        form.setError("code", { message: t`That code is invalid.` });
      }

      onVerifyOTP();
    } catch (err) {
      form.setError("root", {
        message: t`Please try again.`,
      });
    }
  };

  return (
    <div>
      <Button
        className="p-0 text-sm"
        onClick={() => {
          setShowOTPForm(false);
        }}
        variant="link"
      >
        {dir === "ltr" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        <Trans>Go back</Trans>
      </Button>

      <div className="flex flex-col items-center gap-y-4">
        <h1 className="text-center font-bold text-gray-900 text-xl tracking-tight dark:text-white">
          <Trans>Enter your 6-digit code from your email</Trans>
        </h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="mb-4 flex flex-col gap-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel aria-hidden hidden>
                      Code
                    </FormLabel>
                    <FormControl>
                      <OTPInput
                        {...field}
                        containerClassName="group flex items-center has-[:disabled]:opacity-30"
                        maxLength={6}
                        pattern={REGEXP_ONLY_EN_AR_DIGITS}
                        render={({ slots }) => (
                          <>
                            <div className="flex">
                              {slots.slice(0, 3).map((slot, idx) => (
                                <Slot key={idx} {...slot} />
                              ))}
                            </div>

                            <FakeDash />

                            <div className="flex">
                              {slots.slice(3).map((slot, idx) => (
                                <Slot key={idx} {...slot} />
                              ))}
                            </div>
                          </>
                        )}
                      />
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              className="w-full"
              disabled={form.formState.isSubmitting}
              type="submit"
            >
              <Trans>Continue</Trans>
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};
