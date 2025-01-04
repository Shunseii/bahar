import {
  createTRPCClient,
  createTRPCReact,
  httpBatchLink,
} from "@trpc/react-query";
import { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "api";
import { TRACE_ID_HEADER, generateTraceId } from "./utils";

export type RouterInput = inferRouterInputs<AppRouter>;
export type RouterOutput = inferRouterOutputs<AppRouter>;

export const trpc = createTRPCReact<AppRouter>();

export const trpcReactClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_BASE_URL}/trpc`,
      fetch(url, opts) {
        return fetch(url, {
          ...opts,
          credentials: "include",
          headers: {
            ...opts?.headers,
            [TRACE_ID_HEADER]: generateTraceId(),
          },
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
          headers: {
            ...opts?.headers,
            [TRACE_ID_HEADER]: generateTraceId(),
          },
        });
      },
    }),
  ],
});
