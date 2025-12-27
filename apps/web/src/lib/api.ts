import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";
import { generateTraceId, TRACE_ID_HEADER } from "./utils";

export const api = treaty<App>(import.meta.env.VITE_API_BASE_URL, {
  fetch: {
    credentials: "include",
  },
  headers: () => ({
    [TRACE_ID_HEADER]: generateTraceId(),
  }),
});
