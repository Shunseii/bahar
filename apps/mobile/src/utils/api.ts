import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";
import { authClient } from "./auth-client";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();

export const api = treaty<App>(process.env.EXPO_PUBLIC_API_BASE_URL!, {
  headers: () => ({
    cookie: authClient.getCookie(),
  }),
});
