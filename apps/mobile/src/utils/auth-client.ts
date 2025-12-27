import { expoClient } from "@better-auth/expo/client";
import {
  emailOTPClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import type { auth } from "../../../api/src/auth";

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
