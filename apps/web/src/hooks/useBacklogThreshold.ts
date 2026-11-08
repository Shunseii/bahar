import { useQuery } from "@tanstack/react-query";
import { settingsTable } from "@/lib/db/operations";

/**
 * The user's backlog threshold in days, or undefined until settings load.
 *
 * Queue queries should wait for it rather than fall back to the default:
 * splitting cards by the wrong threshold and then re-splitting would reshuffle
 * the review queue under the user.
 */
export const useBacklogThreshold = (): number | undefined => {
  const { data } = useQuery({
    queryFn: settingsTable.getSettings.query,
    ...settingsTable.getSettings.cacheOptions,
  });

  return data?.backlog_threshold_days;
};
