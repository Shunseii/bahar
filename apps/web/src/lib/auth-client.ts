import {
  adminClient,
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "../../../api/src/auth";
import { generateTraceId, TRACE_ID_HEADER } from "./utils";

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
