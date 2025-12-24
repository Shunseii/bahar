/**
 * App initialization hook.
 *
 * Initializes the database and hydrates Orama search index on app startup.
 */

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
        console.error(dbResult.error);
        return;
      }

      const oramaResult = await hydrateOramaDb();
      if (!oramaResult.ok) {
        setState("error");
        setError(`Search error: ${oramaResult.error.type}`);
        console.error(oramaResult.error);
        return;
      }

      setState("ready");
    };

    init();
  }, []);

  return { state, error };
};
