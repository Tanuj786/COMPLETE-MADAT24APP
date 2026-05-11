/**
 * Push notifications via Expo Push API.
 * ────────────────────────────────────────────────────────────
 * - No google-services.json / APNs cert required.
 * - Works in Expo Go, dev builds, and production EAS builds.
 * - Token format expected: `ExponentPushToken[xxx]` (registered
 *   client-side via `expo-notifications`).
 * - Falls back silently when the user has no token registered or
 *   the API call fails (push is best-effort, never blocks logic).
 *
 * Reference: https://docs.expo.dev/push-notifications/sending-notifications/
 */
import { prisma } from "./prisma";
import { log } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export interface PushPayload {
  title: string;
  body: string;
  /** Custom data delivered to the app for deep linking, e.g. { jobId } */
  data?: Record<string, any>;
  /** Sound, default "default". Set null for silent. */
  sound?: "default" | null;
  /** Number on app icon (iOS) */
  badge?: number;
}

function isExpoToken(t: string | null | undefined): t is string {
  if (!t) return false;
  return t.startsWith("ExponentPushToken[") || t.startsWith("ExpoPushToken[");
}

/**
 * Send a push to a single user. No-ops cleanly when:
 *  - user not found
 *  - user has no fcmToken registered
 *  - token is not an Expo push token (raw FCM tokens skipped)
 *  - the network call fails (logged, not thrown)
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (!isExpoToken(user?.fcmToken)) return;

    const message = {
      to: user!.fcmToken,
      title: payload.title,
      body: payload.body,
      sound: payload.sound === undefined ? "default" : payload.sound,
      data: payload.data || {},
      priority: "high" as const,
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    };

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      log.warn("expo push: non-OK status", { status: res.status, userId });
      return;
    }

    const json: any = await res.json().catch(() => null);
    const ticket = json?.data;
    // DeviceNotRegistered → token is stale; clear it so we stop retrying
    if (ticket?.status === "error" && ticket?.details?.error === "DeviceNotRegistered") {
      await prisma.user.update({
        where: { id: userId },
        data: { fcmToken: null },
      }).catch(() => {});
      log.info("expo push: cleared stale token", { userId });
    }
  } catch (e: any) {
    // Never throw from push — it's best-effort
    log.warn("expo push: send failed", { userId, error: e?.message });
  }
}

/**
 * Convenience: send to multiple users in one batched HTTP call.
 * Used for "fan out a new job request to all eligible mechanics".
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fcmToken: true },
    });
    const tokens = users.map(u => u.fcmToken).filter(isExpoToken);
    if (tokens.length === 0) return;

    const messages = tokens.map(to => ({
      to,
      title: payload.title,
      body: payload.body,
      sound: payload.sound === undefined ? "default" : payload.sound,
      data: payload.data || {},
      priority: "high" as const,
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) log.warn("expo push (batch): non-OK", { status: res.status });
  } catch (e: any) {
    log.warn("expo push (batch): failed", { error: e?.message });
  }
}
