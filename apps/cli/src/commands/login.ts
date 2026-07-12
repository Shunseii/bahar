import { randomBytes } from "node:crypto";
import { defineCommand } from "@bunli/core";
import open from "open";
import { WEB_URL } from "../lib/config";
import { saveCredentials } from "../lib/credentials";
import { clearDbInfoCache } from "../lib/db-info-cache";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const waitForCallback = (state: string): Promise<string> =>
  new Promise((resolve, reject) => {
    let server: ReturnType<typeof Bun.serve> | undefined;

    const timeout = setTimeout(() => {
      server?.stop();
      reject(new Error("Login timed out. Please try again."));
    }, LOGIN_TIMEOUT_MS);

    server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);

        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        const receivedState = url.searchParams.get("state");
        const receivedToken = url.searchParams.get("token");

        if (receivedState !== state || !receivedToken) {
          return new Response("Invalid login callback.", { status: 400 });
        }

        clearTimeout(timeout);
        resolve(receivedToken);

        // Stop after the response flushes rather than inside the handler.
        setTimeout(() => server?.stop(), 0);

        return new Response(
          "<html><body>You can close this tab and return to your terminal.</body></html>",
          { headers: { "Content-Type": "text/html" } }
        );
      },
    });

    const authUrl = new URL("/cli-auth", WEB_URL);
    authUrl.searchParams.set("port", String(server.port));
    authUrl.searchParams.set("state", state);

    open(authUrl.toString());
  });

export const loginCommand = defineCommand({
  name: "login",
  description: "Log in to your Bahar account",
  handler: async ({ colors, spinner }) => {
    const state = randomBytes(16).toString("hex");

    const s = spinner();
    s.start("Waiting for you to finish signing in in your browser...");

    try {
      const token = await waitForCallback(state);

      await saveCredentials({ token });
      await clearDbInfoCache();

      s.succeed(colors.green("Logged in successfully."));
    } catch (error) {
      s.fail(
        colors.red(error instanceof Error ? error.message : "Login failed.")
      );
      process.exitCode = 1;
    }
  },
});
