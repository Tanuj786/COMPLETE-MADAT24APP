# Madat24 Mechanic App

The mechanic-side app of the Madat24 roadside-assistance platform. Mechanics use this app to receive job alerts, accept/reject requests, navigate to the customer, complete jobs, generate invoices, and get paid. The customer-side equivalent is `madat24-customer`.

## Setup

```powershell
npm install --legacy-peer-deps
```
> `--legacy-peer-deps` is required because of React 19 peer-dependency conflicts with `lucide-react-native`.

## Configure backend URL

1. In a separate terminal, start the backend (`madat24-backend`).
2. Find your PC's LAN IP: `ipconfig` (Windows) → look for `IPv4 Address . . . : 192.168.x.x`.
3. Edit `lib/api.ts` and set:
   ```ts
   export const BASE_URL = "http://YOUR_PC_IP:4000/api";
   ```
4. Make sure your phone and PC are on the **same WiFi**.

## Run

```powershell
npx expo start --clear
```

- **Android**: open the Expo Go app and scan the QR code.
- **iOS**: open the Camera app and scan the QR code (it'll open in Expo Go).
- **Android Emulator (Android Studio)**: press `a` after Expo starts. Make sure an emulator is already running.

## Build a real APK / AAB (optional)

```powershell
npm i -g eas-cli
eas login
eas build -p android --profile preview
```

## App identity (reference)

| | Value |
|---|---|
| Package (Android) | `com.madat24.mechanic` |
| Bundle ID (iOS)   | `com.madat24.mechanic` |
| URL scheme        | `madat24mechanic://` |
| Display name      | Madat24 Mechanic |

## What's stripped vs the original `madat24-v2` monorepo

- Removed `app/(customer)/` (customer dashboard, request, invoices, history)
- Removed `app/(auth)/customer-login.tsx` and `customer-signup.tsx`
- Removed `app/(shared)/job-details.tsx` (was only navigated to from customer history)
- Landing page updated for mechanic POV (CTAs, stats, "How It Works" copy)
- If a session for a non-mechanic role is found in storage on launch, it's silently cleared and the user lands on the landing page

## Background location for live tracking

The mechanic app declares background location permissions (Android `FOREGROUND_SERVICE`, iOS `UIBackgroundModes: ["location"]`) so customers can track the mechanic's arrival even when the app is backgrounded. This requires:
- Android 10+: customers see "Allow all the time" prompt
- iOS: "Allow Always" prompt
- For an actual EAS Build to keep streaming locations in background, you'll need the `expo-task-manager` + `expo-location` background task setup. The current code only streams while the app is foregrounded — sufficient for active jobs.

## Dev-mode notes

- If the backend is not reachable, the app still works in **local-only mode** for auth (signup/login store accounts in AsyncStorage). Real job dispatch + customer chat + payments require the backend.
- For HTTP traffic on Android release builds (not dev) you'll need `expo-build-properties` with `usesCleartextTraffic: true` — not needed for Expo Go or dev.
