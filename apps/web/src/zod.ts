import { plural, t } from "@lingui/macro";
import z from "zod";

const errorMap: z.ZodErrorMap = (issue, ctx) => {
  if (issue.code === z.ZodIssueCode.invalid_type) {
    if (issue.expected === "string") {
      return { message: t`That is invalid.` };
    }
  }

  if (issue.code === z.ZodIssueCode.invalid_string) {
    if (issue.validation === "email") {
      return { message: t`That email is invalid.` };
    }
  }

  if (issue.code === z.ZodIssueCode.too_small) {
    const val = issue.minimum as number;

    if (issue.type === "string") {
      return {
        message: plural(val, {
          one: "Must be at least # character",
          other: "Must be at least # characters",
        }),
      };
    }
  }

  if (issue.code === z.ZodIssueCode.too_big) {
    const val = issue.maximum as number;

    if (issue.type === "string") {
      return {
        message: plural(val, {
          one: "Cannot exceed # character",
          other: "Cannot exceed # characters",
        }),
      };
    }
  }

  return {
    message: ctx.defaultError,
  };
};

z.setErrorMap(errorMap);

export { z };
