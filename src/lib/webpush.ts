/**
 * Internal helper: sends a Web Push notification to one subscription.
 * Returns true on success, false if the subscription is expired/invalid.
 */

import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_MAILTO!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export { webpush };

export interface PushPayload {
  title:    string;
  body:     string;
  url:      string;
  icon?:    string;
  tag?:     string;
}

/**
 * Send a push notification to a single subscription object.
 * Returns false if the subscription is expired (caller should delete it).
 */
export async function sendPushToSubscription(
  subscription: any,
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    // 410 Gone = subscription expired; 404 Not Found = invalid
    if (err.statusCode === 410 || err.statusCode === 404) {
      return false; // caller should remove this subscription
    }
    console.error("[sendPush] webpush error:", err.message);
    return true; // don't delete on transient errors
  }
}
