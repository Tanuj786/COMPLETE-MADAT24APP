# Madat24 Customer App

The customer-side app of the Madat24 roadside-assistance platform. Riders use this app to request a mechanic, track them live, chat, and pay. The mechanic-side equivalent is `madat24-mechanic`.

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
# install EAS CLI once
npm i -g eas-cli
eas login
eas build -p android --profile preview
```

## App identity (reference)

| | Value |
|---|---|
| Package (Android) | `com.madat24.customer` |
| Bundle ID (iOS)   | `com.madat24.customer` |
| URL scheme        | `madat24customer://` |
| Display name      | Madat24 |

## What's stripped vs the original `madat24-v2` monorepo

- Removed `app/(mechanic)/` (mechanic dashboard, jobs, requests, reviews)
- Removed `app/(auth)/mechanic-login.tsx` and `mechanic-signup.tsx`
- Landing page only shows the customer CTA
- If a session for a non-customer role is found in storage on launch, it's silently cleared and the user lands on the landing page

## Dev-mode notes

- If the backend is not reachable, the app still works in **local-only mode** (signup/login store accounts in AsyncStorage). Real mechanic dispatch + chat + payments require the backend.
- For HTTP traffic on Android release builds (not dev) you'll need `expo-build-properties` with `usesCleartextTraffic: true` — not needed for Expo Go or dev.
