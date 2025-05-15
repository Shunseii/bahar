import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import type { auth } from "api/auth";
import {
  inferAdditionalFields,
  emailOTPClient,
} from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  plugins: [
    expoClient({
      scheme: "bahar",
      storagePrefix: "bahar",
      storage: SecureStore,
    }),
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
  ],

  // TODO: trace id?
});
