import {
  inferAdditionalFields,
  emailOTPClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "api/auth";

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  plugins: [inferAdditionalFields<typeof auth>(), emailOTPClient()],
});
