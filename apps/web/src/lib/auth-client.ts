import {
  inferAdditionalFields,
  emailOTPClient,
  adminClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { TRACE_ID_HEADER, generateTraceId } from "./utils";
import type { auth } from "../../../api/src/auth";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
    adminClient(),
  ],
  fetchOptions: {
    headers: {
      [TRACE_ID_HEADER]: generateTraceId(),
    },
  },
});
