/**
 * Push notification registration (Expo Notifications).
 * ────────────────────────────────────────────────────────────
 * - Asks for notification permission on first call
 * - Returns an Expo push token (`ExponentPushToken[xxx]`)
 * - Sends the token to backend via `apiSaveFcmToken`
 * - Sets up in-app foreground handler (banner + sound)
 *
 * Call `registerPushOnLogin()` once after a successful login/signup
 * (the auth store does this automatically).
 *
 * Notes:
 * - Works on real devices and TestFlight/dev/production builds.
 * - In Expo Go on Android API 33+, permission still needed but
 *   notifications are sandboxed to the Expo Go app.
 * - On simulator/emulator: token request fails gracefully.
 */
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiSaveFcmToken } from "./api";

// Foreground handler — show banner + sound when notification arrives while app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let _registered = false;

export async function registerPushOnLogin(): Promise<string | null> {
  if (_registered) return null;
  if (!Device.isDevice) {
    // Push doesn't work on emulators — silently skip
    return null;
  }

  try {
    // Android: ensure a notification channel exists (required for sound + heads-up)
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Madat24 Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#F97316",
        sound: "default",
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const r = await Notifications.requestPermissionsAsync();
      status = r.status;
    }
    if (status !== "granted") return null;

    // Get the Expo push token. projectId is auto-detected from app config.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResult.data;
    if (!token) return null;

    // Send to backend (best-effort — don't block login on failure)
    apiSaveFcmToken(token).catch(() => {});
    _registered = true;
    return token;
  } catch {
    // Common cause: running on simulator or missing projectId — non-fatal
    return null;
  }
}

/** Call on logout so we re-register on next login */
export function clearPushRegistration() {
  _registered = false;
}

/**
 * Subscribe to incoming foreground notifications. Returns an unsubscribe.
 * Useful for showing in-app toasts in addition to the system banner.
 */
export function onForegroundNotification(
  cb: (n: Notifications.Notification) => void
): () => void {
  const sub = Notifications.addNotificationReceivedListener(cb);
  return () => sub.remove();
}

/**
 * Subscribe to taps on a notification (foreground or background → tap).
 * Use the `data` payload to deep-link (e.g. open job-details).
 */
export function onNotificationTap(
  cb: (data: any) => void
): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    cb(response.notification.request.content.data);
  });
  return () => sub.remove();
}
