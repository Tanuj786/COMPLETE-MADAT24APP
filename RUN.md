# Madat24 — Full Laptop Setup & Run Guide

This guide gets the whole platform running on your Windows laptop.

```
PRODUCTION-APP/
├── madat24-v2/          ← original combined app (kept as a reference; do not edit)
├── madat24-backend/     ← Node + Express + Prisma + Socket.IO API server (run in VS Code)
├── madat24-customer/    ← customer-facing Expo app (run in Android Studio + Expo Go)
└── madat24-mechanic/    ← mechanic-facing Expo app (run in Android Studio + Expo Go)
```

You'll have **3 things running at once** during dev:
- Backend (VS Code terminal) — port `4000`
- Customer Expo app (Android Studio terminal or any terminal) — port `8081`
- Mechanic Expo app (Android Studio terminal or any terminal) — port `8082` (different port to avoid clashing with the customer app)

> **iOS note (important):** Building real `.ipa` files for iPhone requires a Mac with Xcode. Your Windows laptop **cannot** produce iOS native builds. However, both apps **do** run on real iPhones via the **Expo Go** app (download from App Store, scan the QR code). Same goes for Apple Silicon Macs and iPad — Expo Go works there. For real App Store builds, use [EAS Build](https://docs.expo.dev/eas/) (cloud builder, no Mac needed) or get a Mac.

---

## 0 — Prerequisites (install once)

| Tool | Version | Where |
|---|---|---|
| **Node.js**            | 18 or higher | https://nodejs.org |
| **VS Code**            | Latest | https://code.visualstudio.com — for editing + running the backend |
| **Android Studio**     | Latest | https://developer.android.com/studio — for the Android emulator |
| **Expo Go** (on phone) | Latest | iOS App Store / Google Play |
| **Git** (optional)     | Latest | https://git-scm.com — for committing changes |

After installing Android Studio:
1. Open it once → Tools → SDK Manager → install **Android 14 (API 34)** + **Android Emulator**
2. Tools → Device Manager → "Create device" → pick **Pixel 7** + **API 34** image → Finish
3. Test it boots: click ▶ on the device. You'll need this running before you press `a` in Expo.

---

## 1 — Backend (VS Code)

```powershell
cd D:\tan\PRODUCTION-APP\madat24-backend
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:push
npm run dev
```

Expected:
```
🚀 Madat24 Backend running on port 4000
   Health:  http://localhost:4000/health
   API:     http://localhost:4000/api
```

**Verify:** open `http://localhost:4000/health` in a browser → should return JSON with `"status":"✅ running"` and `"db":"connected"`.

> Leave this terminal running. Open new terminals for the apps.

### Troubleshooting backend
- **Port 4000 in use:** edit `.env` → `PORT=4001` → `npm run dev` again. Then update the `BASE_URL` in both apps to use port 4001.
- **`prisma: command not found`:** rerun `npm install`.
- **DB connection error:** delete `prisma/dev.db` and rerun `npm run prisma:push`.

---

## 2 — Find your PC's LAN IP

The phone needs to reach your PC, so we need its address on the local network.

```powershell
ipconfig
```

Look for `IPv4 Address . . . : 192.168.x.x` under your active Wi-Fi adapter (usually labeled "Wireless LAN adapter Wi-Fi"). Write it down — you'll paste it into `lib/api.ts` for both apps.

**Test the IP works from your phone:**
- Phone on same Wi-Fi → open browser → `http://YOUR_PC_IP:4000/health`
- Should load JSON. If it doesn't, **Windows Firewall is blocking port 4000**:

  ```powershell
  # Run PowerShell as Admin, ONE TIME ONLY:
  New-NetFirewallRule -DisplayName "Madat24-Backend" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
  ```

---

## 3 — Customer App (Android Studio terminal)

Open Android Studio → File → Open → `D:\tan\PRODUCTION-APP\madat24-customer`. Use its built-in terminal.

```powershell
npm install --legacy-peer-deps
```

Open `lib/api.ts` and update line 20:
```ts
export const BASE_URL = "http://YOUR_PC_IP:4000/api";
```

Start the app:
```powershell
npx expo start --clear
```

A QR code appears in the terminal.

### Run on your real phone
- **Android phone**: open Expo Go → "Scan QR code" → point at terminal QR.
- **iPhone**: open Camera app → point at QR → tap the banner that appears (it'll open in Expo Go).

### Run on Android Studio emulator
1. Make sure your emulator is running (Tools → Device Manager → ▶).
2. In the Expo terminal, press `a`.

---

## 4 — Mechanic App (separate terminal / second Android Studio window)

Open in another VS Code window: `D:\tan\PRODUCTION-APP\madat24-mechanic`.

```powershell
npm install --legacy-peer-deps
```

Open `lib/api.ts` and set the same BASE_URL as the customer app.

Start it on a different port so it doesn't clash with the customer app's Metro bundler:
```powershell
npx expo start --clear --port 8082
```

Same scan-the-QR flow as the customer app.

> **Tip:** if you only have one Android emulator running, you can install **both apps on the same emulator** — the bundle IDs are different (`com.madat24.customer` vs `com.madat24.mechanic`). Press `a` once in each Expo terminal.

---

## 5 — Test the full flow

With backend + both apps running:

1. **Customer app**: tap *Create Account*, sign up as a customer with any email.
2. **Mechanic app**: tap *Join the Network*, sign up as a mechanic. In the profile screen, **tap Online** so you accept jobs.
3. **Customer app**: dashboard → *Need Assistance* → pick a service → submit. You should see an alert on the mechanic side within a second (real-time via Socket.IO).
4. **Mechanic app**: requests tab → *Accept*. Watch the customer screen update live.
5. **Mechanic app**: jobs tab → *Start Job* → *Complete & Invoice* → fill in items → *Generate*.
6. **Customer app**: *Pay Now* → choose any method (dev mode auto-succeeds).
7. **Customer app**: leave a review.

---

## What runs where (cheat sheet)

| App                | Open in        | Run command                          | Port  |
|--------------------|----------------|--------------------------------------|-------|
| `madat24-backend`  | VS Code        | `npm run dev`                        | 4000  |
| `madat24-customer` | Android Studio | `npx expo start --clear`             | 8081  |
| `madat24-mechanic` | Android Studio | `npx expo start --clear --port 8082` | 8082  |

---

## Common issues

| Symptom | Fix |
|---|---|
| App says "Cannot connect to server" | Wrong IP in `lib/api.ts`, or Windows Firewall blocking port 4000. Test from phone browser: `http://<PC-IP>:4000/health` should load. |
| App stuck on splash / white screen | Stop Expo (`Ctrl+C`) and run `npx expo start --clear`. |
| `Module not found` / `~` alias errors | Run `npm install --legacy-peer-deps` again. |
| Phone shows old code after edit | Shake phone → "Reload" in Expo Go. |
| Two Expo terminals fighting | One must use `--port 8082` (or any free port). |
| iOS "Untrusted developer" | Settings → General → VPN & Device Management → trust the profile. |
| Sockets not connecting | Inspect logs in the Expo terminal. Local-mode tokens (`local_…`) are intentionally rejected by sockets — log out and log back in once the backend is running. |

---

## What you DON'T need

- ❌ Local PostgreSQL — backend uses **SQLite** by default (file at `madat24-backend/prisma/dev.db`)
- ❌ Docker
- ❌ Redis
- ❌ A Mac, **unless** you want to ship to the iOS App Store (Expo Go works for iOS during dev)
- ❌ A paid Apple Developer account, until you ship to the App Store

---

## Going to production (later)

1. Switch the backend DB from SQLite to PostgreSQL — see `madat24-backend/README.md`.
2. Fill in real keys in `madat24-backend/.env` (SMTP, Twilio, Razorpay, Cloudinary).
3. Use **EAS Build** to produce store-ready Android `.aab` and iOS `.ipa` from your Windows laptop:
   ```powershell
   npm i -g eas-cli
   eas login
   cd madat24-customer ; eas build -p android --profile production
   cd madat24-mechanic ; eas build -p android --profile production
   # iOS:
   cd madat24-customer ; eas build -p ios --profile production
   cd madat24-mechanic ; eas build -p ios --profile production
   ```
4. Deploy the backend to a host with a public URL (Railway, Render, Fly.io, AWS, DigitalOcean, etc.) and update `BASE_URL` in both apps to the production URL (use `https://`).
