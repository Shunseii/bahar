import {
  createTRPCClient,
  createTRPCReact,
  httpBatchLink,
} from "@trpc/react-query";
import type { AppRouter } from "@repo/api";

export const trpc = createTRPCReact<AppRouter>();

export const trpcReactClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_BASE_URL}/trpc`,
      fetch(url, opts) {
        return fetch(url, {
          ...opts,
          credentials: "include",
        });
      },
    }),
  ],
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_BASE_URL}/trpc`,
      fetch(url, opts) {
        return fetch(url, {
          ...opts,
          credentials: "include",
        });
      },
    }),
  ],
});
