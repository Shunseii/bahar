/**
 * Local review-reminder notifications (v1).
 *
 * Cards become due on their own schedule (FSRS). Rather than one notification
 * per card -- which would both blow past iOS's 64-pending-notification cap and
 * hammer the user when a review batch is graded seconds apart (all due ~15 min
 * later) -- upcoming due times are coalesced into a few "N cards ready"
 * reminders. All scheduling is on-device (expo-notifications); no server push.
 *
 * Deferred to BAH-175: daily summary, quiet hours, streak reminders.
 */

import * as Sentry from "@sentry/react-native";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { flashcardsTable } from "@/lib/db/operations";
import { notificationsEnabledAtom, store } from "@/lib/store";
import { computeReminders } from "./scheduling";

const REVIEW_CHANNEL_ID = "review-reminders";
const REVIEW_NOTIFICATION_TYPE = "review-reminder";

/** How far ahead to schedule reminders. Beyond this is the daily summary's job. */
const HORIZON_MS = 24 * 60 * 60 * 1000;

let configured = false;

/**
 * One-time setup: foreground presentation behavior and the Android channel.
 * Safe to call more than once.
 */
export const configureNotifications = async (): Promise<void> => {
  if (configured) return;
  configured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REVIEW_CHANNEL_ID, {
      name: "Review reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
};

/**
 * Requests OS notification permission. Returns whether it's granted. Establishes
 * the app's first runtime-permission flow.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

const hasNotificationPermission = async (): Promise<boolean> =>
  (await Notifications.getPermissionsAsync()).granted;

/**
 * Reconciles the stored preference with the live OS permission. If the user
 * turned reminders on but later revoked notification permission in system
 * settings, the toggle would otherwise still read "on" while nothing fires --
 * flip it back off (and clear any strays) so the UI reflects reality. Called on
 * app foreground and when the settings screen mounts.
 */
export const reconcileNotificationPermission = async (): Promise<void> => {
  if (!store.get(notificationsEnabledAtom)) return;
  if (await hasNotificationPermission()) return;

  store.set(notificationsEnabledAtom, false);
  await cancelReviewNotifications();
};

/**
 * Cancels only the review reminders we scheduled (leaves any other/future
 * notification types intact), identified by the `type` tag in their data.
 */
export const cancelReviewNotifications = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.type === REVIEW_NOTIFICATION_TYPE)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
};

/**
 * Dismisses already-delivered review reminders from the tray / notification
 * center -- distinct from cancelling *scheduled* ones. Called on app foreground:
 * once the user is in the app, a lingering "cards ready" banner is just noise.
 * Only clears our own review reminders, not other notifications.
 */
export const dismissReviewNotifications = async (): Promise<void> => {
  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.all(
    presented
      .filter((n) => n.request.content.data?.type === REVIEW_NOTIFICATION_TYPE)
      .map((n) => Notifications.dismissNotificationAsync(n.request.identifier))
  );
};

/**
 * Recomputes and reschedules review reminders from the current due schedule.
 * Cancel-then-reschedule so there's always at most MAX_REMINDERS pending. Called
 * on the triggers where the due set can change: app start, app backgrounding,
 * and after a sync. Fire-and-forget -- failures are captured, never thrown.
 */
export const recomputeReviewNotifications = async (): Promise<void> => {
  try {
    await cancelReviewNotifications();

    const enabled = store.get(notificationsEnabledAtom);
    if (!enabled) return;
    if (!(await hasNotificationPermission())) return;

    const dueTimestamps = await flashcardsTable.upcomingDue.query({
      horizonMs: HORIZON_MS,
    });
    const reminders = computeReminders(dueTimestamps, Date.now());

    Sentry.logger.info("review notifications rescheduled", {
      upcoming: dueTimestamps.length,
      scheduled: reminders.length,
      fireAts: reminders.map((r) => new Date(r.fireAt).toISOString()),
    });

    await Promise.all(
      reminders.map((reminder) =>
        Notifications.scheduleNotificationAsync({
          content: {
            title: "Time to review",
            body:
              reminder.count === 1
                ? "1 card is ready to review."
                : `${reminder.count} cards are ready to review.`,
            data: { type: REVIEW_NOTIFICATION_TYPE },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(reminder.fireAt),
            ...(Platform.OS === "android"
              ? { channelId: REVIEW_CHANNEL_ID }
              : {}),
          },
        })
      )
    );
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: "recomputeReviewNotifications" },
    });
  }
};
