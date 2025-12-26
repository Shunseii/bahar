import { plural, t } from "@lingui/core/macro";
import { z } from "zod/v4";

export const errorMap: z.core.$ZodErrorMap = (issue) => {
  if (issue.code === "invalid_type") {
    if (issue.expected === "string") {
      return t`This field is required.`;
    }
  }

  if (issue.code === "invalid_format") {
    if (issue.format === "email") {
      return t`That email is invalid.`;
    }
  }

  if (issue.code === "too_small") {
    const val = issue.minimum as number;

    if (issue.type === "string") {
      if (val === 1) {
        return t`This field is required.`;
      }

      return plural(val, {
        one: "Must be at least # character",
        other: "Must be at least # characters",
      });
    }
  }

  if (issue.code === "too_big") {
    const val = issue.maximum as number;

    if (issue.type === "string") {
      return plural(val, {
        one: "Cannot exceed # character",
        other: "Cannot exceed # characters",
      });
    }
  }

  return undefined;
};

z.config({ customError: errorMap });
