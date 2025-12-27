import * as Sentry from "@sentry/bun";
import Elysia from "elysia";
import { auth } from "./auth";
import { getTraceContext } from "./utils/logger";

export { httpLogger } from "./middleware/http-logger";

export const betterAuthGuard = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: (role?: "admin" | "user") => ({
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });

        if (!session) return status(401);

        if (role === "admin" && session.user.role !== "admin") {
          return status(403);
        }

        const context = getTraceContext();

        context.userId = session.user.id;
        context.sessionId = session.session.id;

        Sentry.setUser({ id: session.user.id, email: session.user.email });

        return {
          user: session.user,
          session: session.session,
        };
      },
    }),
  });
