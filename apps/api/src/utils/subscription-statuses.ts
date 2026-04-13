// https://polar.sh/docs/integrate/webhooks/events#cancellation-sequences
export const SUBSCRIPTION_STATUSES = [
  // Initial payment hasn't been completed yet
  "incomplete",

  // The incomplete subscription expired before payment was completed
  "incomplete_expired",

  // Subscription is in a free trial period
  "trialing",

  // Subscription is running normally with successful billing. Also includes when a user
  // has cancelled their subscription but the billing period hasn't ended yet.
  "active",

  // A payment has failed; the customer can recover by updating their payment method
  "past_due",

  // Subscription has been definitively canceled (billing stopped, benefits revoked). Also used for the "revoked" logical state
  "canceled",

  // Subscription remains unpaid after exhausting retry attempts
  "unpaid",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
