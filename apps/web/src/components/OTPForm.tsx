import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { zodResolver } from "@hookform/resolvers/zod";
import { OTPInput, SlotProps } from "input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm, SubmitHandler } from "react-hook-form";
import z from "zod";
import {
  REGEXP_ONLY_EN_AR_DIGITS,
  cn,
  convertArabicNumToEnglish,
} from "@/lib/utils";
import { Trans, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSetAtom } from "jotai";
import { showOTPFormAtom } from "@/atoms/otp";
import { TLocale, getLangDir } from "@/lib/i18n";
import { FC } from "react";

const schema = z.object({
  code: z.string().length(6, {
    message: "That code is invalid.",
  }),
});

function Slot(props: SlotProps) {
  return (
    <div
      className={cn(
        "relative w-10 h-14 text-[2rem]",
        "flex items-center justify-center",
        "transition-all duration-300",
        "border-border border-y",
        "ltr:border-r ltr:first:border-l ltr:first:rounded-l-md ltr:last:rounded-r-md",
        "rtl:border-l rtl:first:border-r rtl:first:rounded-r-md rtl:last:rounded-l-md",
        "group-hover:border-accent-foreground/20 group-focus-within:border-accent-foreground/20",
        "outline outline-0 outline-accent-foreground/20",
        { "outline-4 outline-accent-foreground": props.isActive },
      )}
    >
      {props.char !== null && <div>{props.char}</div>}
      {props.hasFakeCaret && <FakeCaret />}
    </div>
  );
}

function FakeCaret() {
  return (
    <div className="absolute pointer-events-none inset-0 flex items-center justify-center animate-caret-blink">
      <div className="w-px h-8 bg-white" />
    </div>
  );
}

function FakeDash() {
  return (
    <div className="flex w-10 justify-center items-center">
      <div className="w-3 h-1 rounded-full bg-border" />
    </div>
  );
}

export const OTPForm: FC<{
  onSubmitForm: (code: string) => Promise<void>;
}> = ({ onSubmitForm }) => {
  const setShowOTPForm = useSetAtom(showOTPFormAtom);
  const { i18n } = useLingui();

  const validateCode = trpc.auth.validateOTP.useMutation();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    reValidateMode: "onSubmit",
    defaultValues: {
      code: "",
    },
  });

  const dir = getLangDir(i18n.locale as TLocale);

  const onSubmit: SubmitHandler<z.infer<typeof schema>> = async (data) => {
    try {
      const normalizedCode = convertArabicNumToEnglish(data.code);

      await onSubmitForm(normalizedCode);
    } catch (err) {
      // validateCode.error and validateLoginCode.error have the same properties
      const error = err as typeof validateCode.error;

      if (
        error?.message === "invalid_code" ||
        error?.message === "expired_code"
      ) {
        form.setError("code", { message: t`That code has expired.` });
      } else if (error?.message === "TOO_MANY_REQUESTS") {
        form.setError("code", {
          message: t`Please try again after 30 seconds.`,
        });
      }

      // TODO: Show toast message with general error message
    }
  };

  return (
    <div>
      <Button
        onClick={() => {
          setShowOTPForm(false);
        }}
        className="p-0 text-sm"
        variant="link"
      >
        {dir === "ltr" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        <Trans>Go back</Trans>
      </Button>

      <div className="flex flex-col gap-y-4 items-center">
        <h1 className="tracking-tight font-bold text-xl dark:text-white text-center text-gray-900">
          <Trans>Enter your 6-digit code from your email</Trans>
        </h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-y-4 mb-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel hidden aria-hidden>
                      Code
                    </FormLabel>
                    <FormControl>
                      <OTPInput
                        {...field}
                        maxLength={6}
                        pattern={REGEXP_ONLY_EN_AR_DIGITS}
                        containerClassName="group flex items-center has-[:disabled]:opacity-30"
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
              type="submit"
              disabled={form.formState.isSubmitting}
              className="w-full"
            >
              <Trans>Continue</Trans>
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
};
