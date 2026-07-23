/**
 * App initialization hook.
 *
 * Initializes the database and hydrates Orama search index on app startup.
 */

import * as Sentry from "@sentry/react-native";
import { useEffect, useState } from "react";
import { initDb } from "@/lib/db";
import { hydrateOramaDb } from "@/lib/search";

type InitState = "idle" | "loading" | "ready" | "error";

interface UseAppInitResult {
  state: InitState;
  error: string | null;
}

export const useAppInit = (): UseAppInitResult => {
  const [state, setState] = useState<InitState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setState("loading");

      const dbResult = await initDb();
      if (!dbResult.ok) {
        setState("error");
        setError(`Database error: ${dbResult.error.type}`);
        Sentry.captureException(
          new Error(dbResult.error.type, { cause: dbResult.error }),
          {
            fingerprint: ["db-init-error", dbResult.error.type],
            contexts: {
              db_init: {
                type: dbResult.error.type,
                reason: dbResult.error.reason,
                // Preserved from the underlying throw -- for a wasm trap the
                // stack carries the native frames that String(error) would drop.
                name: dbResult.error.name ?? null,
                stack: dbResult.error.stack ?? null,
                cause: dbResult.error.cause ?? null,
                wasmTrap: dbResult.error.wasmTrap ?? null,
                migrationVersion: dbResult.error.migrationVersion ?? null,
              },
            },
          }
        );
        return;
      }

      const oramaResult = await hydrateOramaDb();
      if (!oramaResult.ok) {
        setState("error");
        setError(`Search error: ${oramaResult.error.type}`);
        Sentry.captureException(
          new Error(oramaResult.error.type, { cause: oramaResult.error }),
          {
            fingerprint: ["orama-hydration-error", oramaResult.error.type],
            contexts: {
              orama_hydration: {
                type: oramaResult.error.type,
                reason: oramaResult.error.reason,
              },
            },
          }
        );
        return;
      }

      setState("ready");
    };

    init();
  }, []);

  return { state, error };
};
