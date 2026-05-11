# Madat24 — Production Launch Checklist

**Status of the codebase right now:** all three projects (`madat24-backend`, `madat24-customer`, `madat24-mechanic`) are production-grade in code: env-validated boot, JWT auth, atomic dispatch, rate limits, helmet, structured logs, Dockerfile, EAS build profiles, no plain-text passwords on device, validated request bodies, request-IDs, and a graceful 404/error handler.

**Why you can't launch yet:** publishing to the App Store / Play Store needs accounts, money, real assets, legal docs, and a deployed backend. None of those can be done from inside the codebase. This file is the punch list.

Everything below is broken into **DO ONCE** tasks (one-time setup) and **DO PER RELEASE** tasks (every time you ship a new version).

---

## 0. Cost summary (so you know going in)

| Item | One-time | Recurring |
|---|---|---|
| Apple Developer Program | — | **$99 / year** |
| Google Play Developer | **$25** | — |
| Domain (e.g. `madat24.com`) | — | ~$12 / year |
| Backend hosting (Railway / Render hobby) | — | **$0** to start, $5/mo when traffic grows |
| Postgres (Neon free tier) | — | **$0** to start, ~$19/mo at scale |
| Cloudinary (image hosting) free tier | — | **$0** to start |
| SMTP (Gmail SMTP / SendGrid free) | — | **$0** to start |
| Twilio (SMS) | — | pay-per-message (~₹0.5 per SMS in India) |
| Razorpay | — | **2% per transaction**, no fixed fee |
| Privacy policy generator (Termly / Iubenda) | — | $0–$10/mo |
| Sentry (errors) — free tier | — | **$0** to start |

**Minimum to go live with both apps:** ≈ **$130 first year** + 2% per payment.

---

## 1. DO ONCE — Accounts to create

- [ ] **Apple Developer Program** — https://developer.apple.com/programs/ — needed for iOS builds. Use a real legal name (or company name). Approval takes 24–48 h.
- [ ] **Google Play Console** — https://play.google.com/console/signup — $25 one-time. Approval is usually instant.
- [ ] **Expo / EAS account** — https://expo.dev/signup — free. You'll run `eas login` once on your laptop.
- [ ] **GitHub repo** — push the three projects so EAS / your host can pull them.
- [ ] **Domain registrar** — buy `madat24.com` (or whatever) at Namecheap / Cloudflare.
- [ ] **Backend host** — pick one (recommended: **Railway** — easiest):
  - Railway: https://railway.app
  - Alternatives: Render, Fly.io, AWS App Runner, DigitalOcean App Platform
- [ ] **Postgres** — **Neon** free tier is best: https://neon.tech. Copy the `DATABASE_URL`.
- [ ] **Cloudinary** — https://cloudinary.com/users/register/free. Copy the cloud name + API key + secret.
- [ ] **SMTP provider** — **SendGrid** free tier (100 emails/day): https://sendgrid.com. Get an API key.
- [ ] **Twilio** — https://twilio.com — buy an Indian number (~₹100). Get account SID + auth token.
- [ ] **Razorpay** — https://razorpay.com. Business KYC takes 2–3 days. Get test keys immediately, live keys after KYC.
- [ ] **Sentry** — https://sentry.io. Free tier covers 5k events/month. Create one project per app + one for backend.
- [ ] **Firebase** — https://console.firebase.google.com. Create a project for FCM push notifications. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).

---

## 2. DO ONCE — Legal & content

- [ ] **Privacy Policy** + **Terms of Service** — generate at https://www.termly.io or https://www.iubenda.com (free templates available). Host them at `https://madat24.com/privacy` and `https://madat24.com/terms`. Both stores require these URLs to be live.
- [ ] **App icon** — 1024×1024 PNG, no transparency, no rounded corners. Use https://www.canva.com or hire a designer (~$20 on Fiverr). Save as `assets/icon.png` in BOTH apps.
- [ ] **Splash screen** — 1242×2436 PNG. Save as `assets/splash.png` in both apps.
- [ ] **Adaptive icon (Android)** — 1024×1024 foreground + solid background color. Save as `assets/adaptive-icon.png` and update `app.json`.
- [ ] **Screenshots** — 2 phones (one customer, one mechanic) showing real app states. Need 3-5 each, sized:
  - iPhone 6.7": 1290×2796
  - Phone Android: 1080×1920
- [ ] **App Store description** — short blurb (170 chars) + long description (4000 chars) for each app, in English. Target keywords: "roadside assistance", "mechanic on demand", "car breakdown".
- [ ] **App categories**:
  - Customer app: Travel / Lifestyle
  - Mechanic app: Business / Productivity

---

## 3. DO ONCE — Deploy the backend

> **Easiest path: Railway.** It auto-detects the Dockerfile, gives you a free Postgres add-on, and HTTPS is automatic.

```bash
# 1. Push madat24-backend to GitHub.
# 2. https://railway.app → New Project → Deploy from GitHub Repo → pick madat24-backend
# 3. Railway will detect the Dockerfile and start building.
# 4. Add a Postgres database: + New → Database → PostgreSQL.
# 5. Click your backend service → Variables tab → add:
```

Required env vars in Railway:
```env
NODE_ENV=production
JWT_SECRET=<run `openssl rand -hex 64` and paste output>
DATABASE_URL=${{Postgres.DATABASE_URL}}    # Railway auto-injects this
CORS_ORIGIN=https://madat24.com,https://app.madat24.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<your SendGrid API key>
SMTP_FROM=Madat24 <noreply@madat24.com>
TWILIO_ACCOUNT_SID=<your sid>
TWILIO_AUTH_TOKEN=<your token>
TWILIO_PHONE=<your twilio number>
RAZORPAY_KEY_ID=<your live key>
RAZORPAY_KEY_SECRET=<your live secret>
SENTRY_DSN=<your backend sentry dsn>
```

> **The backend will refuse to boot in production with weak defaults.** Env validation in `src/env.ts` checks for them and exits cleanly with a clear message — that's intentional.

After deploy:
- [ ] Verify `https://your-backend.up.railway.app/health` returns `"db":"connected"`.
- [ ] Switch Prisma schema from `provider = "sqlite"` to `provider = "postgresql"` (in `prisma/schema.prisma`), commit, push. Railway will rebuild and run `prisma migrate deploy` automatically.
- [ ] Wire your custom domain: Railway → Settings → Domains → add `api.madat24.com`. Update DNS at your registrar.

---

## 4. DO ONCE — Configure both apps for production

- [ ] In `madat24-customer/eas.json` and `madat24-mechanic/eas.json`, replace the `production.env.API_URL` with your actual backend URL (e.g. `https://api.madat24.com/api`).
- [ ] In `app.json` for each app, bump `version` to `1.0.0`.
- [ ] In `app.json`, replace placeholder bundle IDs with your real ones (`com.madat24.customer` is fine if you're the only one). These can NEVER change after first store submission.
- [ ] Drop in real `assets/icon.png`, `assets/splash.png`, `assets/adaptive-icon.png`.
- [ ] Add Firebase config files to BOTH apps (one set per app):
  - `google-services.json` at the root of each app folder
  - `GoogleService-Info.plist` at the root of each app folder
  - Add to `app.json` plugins: `["@react-native-firebase/app"]` (also `npm install @react-native-firebase/app @react-native-firebase/messaging`)
- [ ] (Optional but strongly recommended) Add Sentry:
  ```bash
  npx expo install sentry-expo
  ```
  Add to `app.json` plugins: `"sentry-expo"`. Then in `app/_layout.tsx`:
  ```ts
  import * as Sentry from "sentry-expo";
  import Constants from "expo-constants";
  Sentry.init({ dsn: Constants.expoConfig?.extra?.SENTRY_DSN, enableInExpoDevelopment: false });
  ```
  And in `eas.json`, add `SENTRY_DSN` to each profile's `env`.

---

## 5. DO PER RELEASE — Build & submit

> First-time setup of EAS:
> ```bash
> npm install -g eas-cli
> eas login
> cd madat24-customer && eas build:configure  # links project to your EAS account
> cd ../madat24-mechanic && eas build:configure
> ```

### Android (Google Play)
```bash
# Customer app
cd madat24-customer
eas build --platform android --profile production
# When done, eas will give you a download link to a .aab file.

# Mechanic app
cd ../madat24-mechanic
eas build --platform android --profile production

# Upload BOTH .aab files to Play Console:
#   Play Console → your app → Production → Create new release → Upload
```

### iOS (App Store)
```bash
cd madat24-customer
eas build --platform ios --profile production    # produces an .ipa via EAS Cloud (no Mac needed)

cd ../madat24-mechanic
eas build --platform ios --profile production

# Submit (still no Mac needed):
eas submit --platform ios --profile production
```

### Pre-submission checklist (first release)
- [ ] Privacy policy URL is live and reachable
- [ ] Terms URL is live and reachable
- [ ] Real screenshots uploaded (3-5 per device size)
- [ ] App description, keywords, support email filled in
- [ ] Test the production build (`eas build --profile preview` produces an APK you can install on your phone) end-to-end against the LIVE backend before submitting
- [ ] Razorpay live keys verified with one real transaction (you can refund yourself)

---

## 6. Ongoing operations

- [ ] **Backups**: Neon does daily auto-backups for free. Confirm in Neon dashboard.
- [ ] **Monitoring**: Sentry catches crashes; Railway dashboard shows backend logs.
- [ ] **Updates**: Use OTA updates via `eas update` for JS-only changes (no store re-review needed). Native changes (new permissions, native deps) require a fresh build + store review.
- [ ] **Push notifications**: when sending from backend, use FCM HTTP v1 API. Add a `src/routes/push.ts` with admin-only endpoints to send messages — left as a TODO since it requires the FCM service account JSON.

---

## 7. What's still gaps in the code that I'd add for v2

These are not blockers for launch, but worth knowing:

- Background location streaming on Android (mechanic visible while app closed) — needs `expo-task-manager` + `expo-location` BackgroundLocation
- Real Razorpay client SDK integration (currently uses our `tap-to-pay` shortcut; works fine in dev / for cash-style mark-paid; live UPI flow needs the Razorpay React Native module)
- Email verification on signup (currently anyone can claim any email)
- Phone verification on mechanic signup (use the existing `apiSendPhoneOtp` flow)
- Image processing / resizing on upload (sharp on the backend)
- Migrate from local `uploads/` to Cloudinary (the integration code is wired, just needs `CLOUDINARY_*` env vars and a `cloudinary` SDK call instead of `multer.diskStorage`)
- Unit tests on the backend dispatch logic
- Detox E2E tests on the apps
- CI/CD: GitHub Actions to run `npm run typecheck` on every PR

---

## TL;DR — minimum path to a real launch

1. Get the accounts in section 1
2. Generate Privacy + Terms (section 2)
3. Push backend to Railway with real env (section 3)
4. Update `eas.json` API_URL to your Railway URL (section 4)
5. `eas build --platform android --profile production` for both apps
6. Upload to Play Console
7. Wait 2-3 days for review
8. You're live

iOS: same flow, replace `android` with `ios` and submit via `eas submit`.

You can start with **Android only** — it's faster, cheaper, and 90% of your Indian audience.
