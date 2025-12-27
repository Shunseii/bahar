import { treaty } from "@elysiajs/eden";
import { QueryClient } from "@tanstack/react-query";
import type { App } from "../../../api/src/index";
import { authClient } from "./auth-client";

export const queryClient = new QueryClient();

export const api = treaty<App>(process.env.EXPO_PUBLIC_API_BASE_URL!, {
  headers: () => ({
    cookie: authClient.getCookie(),
  }),
});
