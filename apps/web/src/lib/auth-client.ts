import {
  inferAdditionalFields,
  emailOTPClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "api/auth";
import { TRACE_ID_HEADER, generateTraceId } from "./utils";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  plugins: [inferAdditionalFields<typeof auth>(), emailOTPClient()],
  fetchOptions: {
    headers: {
      [TRACE_ID_HEADER]: generateTraceId(),
    },
  },
});
