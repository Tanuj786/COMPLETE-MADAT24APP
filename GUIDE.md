# MADAT24/7 — Complete Run, Update & Deploy Guide

> Roadside mechanic on-demand marketplace — backend + customer app + mechanic app.
>
> Yeh single document end-to-end cover karta hai: development, testing, updates, production deploy, scaling, security.
> Hinglish technical notes — sab kuch step-by-step.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Quick Start (Local Dev)](#2-quick-start-local-dev)
3. [Backend — Run, Update & Test](#3-backend)
4. [Frontend Apps — Run & Test](#4-frontend-apps)
5. [Database Migrations](#5-database-migrations)
6. [API Keys & Integrations](#6-api-keys--integrations)
7. [Rating & Review System](#7-rating--review-system)
8. [Push Notifications](#8-push-notifications)
9. [Testing End-to-End Flow](#9-end-to-end-test-flow)
10. [Production Deployment](#10-production-deployment)
11. [Scaling Guide (1K → 100K users)](#11-scaling-guide)
12. [Security Checklist](#12-security-checklist)
13. [Cost Estimates (India)](#13-cost-estimates)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. PROJECT OVERVIEW

**3 codebases:**
| Folder | What | Tech |
|---|---|---|
| `madat24-backend` | REST API + Socket.IO realtime + Prisma DB | Node 18+, Express, Prisma, TypeScript |
| `madat24-customer` | Customer mobile app | Expo SDK 53, React Native, Zustand |
| `madat24-mechanic` | Mechanic mobile app | Expo SDK 53, React Native, Zustand |

**Key features built:**
- ✅ Email + Phone OTP signup with mandatory verification
- ✅ JWT auth, saved-credentials suggestion ("Continue as X")
- ✅ Geo-dispatch — customer's request fans out to mechanics within 5 km (Haversine)
- ✅ Atomic accept (no two mechanics can claim same job)
- ✅ Realtime chat (Socket.IO) + live mechanic location tracking
- ✅ Photo upload (customer's vehicle + mechanic's progress/completion proof)
- ✅ Invoice with line items + GST + UPI QR code (scannable)
- ✅ Razorpay + UPI deep-link + Cash + One-Time Credit
- ✅ Rating & review (recomputes mechanic average)
- ✅ Expo Push Notifications on every key event
- ✅ AI Automobile Assistant (Claude Haiku) — guest mode + logged-in mode
- ✅ Splash with mechanic gear+wrench animation, "MADAT24/7" brand

---

## 2. QUICK START (LOCAL DEV)

**Prerequisites:**
- Node.js 18+ (`node --version`)
- npm 10+ (`npm --version`)
- Expo CLI (`npx expo --version` — installs on first use)
- Real phone with **Expo Go** app (Android/iOS) on the same WiFi as your PC
- Optional: Android Studio emulator OR iOS simulator (push won't work on simulators)

**3 terminal windows:**

```powershell
# Terminal 1 — Backend
cd D:\tan\PRODUCTION-APP\madat24-backend
npm install
npm run prisma:generate
npm run prisma:push          # creates dev.db (SQLite) — first time only
npm run dev                  # starts on :4000 with auto-reload

# Terminal 2 — Customer app
cd D:\tan\PRODUCTION-APP\madat24-customer
npm install
npm start                    # opens Metro bundler — scan QR with Expo Go

# Terminal 3 — Mechanic app
cd D:\tan\PRODUCTION-APP\madat24-mechanic
npm install
npm start
```

**LAN IP setup** (phone needs to reach your PC):
```powershell
ipconfig                     # find your IPv4, e.g. 192.168.1.14
```

Edit `madat24-backend\.env`:
```
LOCAL_IP="192.168.1.14"
```

Both Expo apps fall back to `http://192.168.1.14:4000/api`. To override per-build:
```powershell
$env:API_URL = "http://192.168.1.14:4000/api"
npm start
```

---

## 3. BACKEND

### 3.1 Folder Structure
```
madat24-backend/
├── prisma/
│   └── schema.prisma         # DB models (12 models)
├── src/
│   ├── index.ts              # Express bootstrap
│   ├── env.ts                # Env validation (Zod)
│   ├── auth.ts               # JWT + bcrypt
│   ├── prisma.ts             # DB client singleton
│   ├── socket.ts             # Socket.IO server
│   ├── push.ts               # Expo push helper
│   ├── dispatch.ts           # 5km geo-dispatch logic
│   ├── scheduler.ts          # Re-broadcast & expire pending jobs
│   ├── schemas.ts            # Zod request validators
│   ├── middleware.ts         # Rate limits, error handler
│   ├── logger.ts             # Pino + Sentry
│   └── routes/
│       ├── auth.ts           # signup, login, /me, fcm-token
│       ├── email.ts          # email OTP send/verify
│       ├── sms.ts            # phone OTP send/verify
│       ├── jobs.ts           # create + nearby + status + location
│       ├── mechanic.ts       # accept, profile, online, complete
│       ├── payments.ts       # invoice, Razorpay, UPI, credit
│       ├── chat.ts           # job-scoped chat + image upload
│       ├── media.ts          # vehicle/progress/completion photos
│       ├── reviews.ts        # rating submit, recompute
│       ├── notifications.ts  # list, mark-read
│       └── ai.ts             # Claude Haiku chat (guest + auth)
└── .env                      # YOUR secrets (never commit)
```

### 3.2 Run Commands

```powershell
npm run dev          # dev mode with auto-reload
npm run typecheck    # TypeScript check, no compile
npm run build        # tsc → dist/
npm start            # production: node dist/index.js
npm run prisma:push  # apply schema.prisma to DB (NO migration history)
npm run prisma:migrate    # create migration file (production-safe)
npm run prisma:studio     # DB GUI in browser
```

### 3.3 Adding a New Endpoint

1. Create handler in `src/routes/myroute.ts`
2. Mount in `src/index.ts`:
   ```ts
   import myRoutes from "./routes/myroute";
   app.use("/api/myroute", myRoutes);
   ```
3. Add Zod schema in `src/schemas.ts` if accepting request body
4. Run `npm run typecheck` to confirm
5. Hit endpoint with curl / Insomnia / Postman to verify

### 3.4 Adding a New DB Field

```prisma
// prisma/schema.prisma
model User {
  myNewField String?    // <-- add
}
```

```powershell
npm run prisma:push      # dev — instant sync
# OR for production:
npm run prisma:migrate -- --name add_my_new_field    # creates migration file
```

The Prisma client regenerates automatically. Restart `npm run dev`.

---

## 4. FRONTEND APPS

### 4.1 Folder Structure (both apps identical)
```
madat24-customer/      (or madat24-mechanic/)
├── app/                   # Expo Router file-based routes
│   ├── _layout.tsx        # Root layout + splash + session restore
│   ├── index.tsx          # Landing/welcome screen
│   ├── (auth)/            # login, signup, forgot-password
│   ├── (customer)/        # tabs: dashboard, request, history, invoices, profile
│   └── (shared)/          # job-details, notifications, ai-assistant
├── components/
│   ├── shared/            # AuthScreens (shared across apps)
│   └── ui/                # primitives (Toast, PressableScale, etc.)
├── lib/
│   ├── api.ts             # all backend calls
│   ├── push.ts            # Expo push registration
│   └── icons/Icon.tsx     # Lucide icon wrapper
├── stores/
│   ├── index.ts           # Zustand: auth, customer, mechanic, chat, notif
│   └── themeStore.ts      # dark/light + accent
├── constants/index.ts     # FONTS, SERVICES, STATUS_CFG, theme
├── types/index.ts         # TypeScript interfaces
└── app.json               # Expo config (name, icon, permissions)
```

### 4.2 Run Commands

```powershell
npm start            # dev server, scan QR
npx tsc --noEmit     # typecheck (no script for it — run directly)
npx expo prebuild    # generate native android/ios folders (only for EAS)
```

### 4.3 Adding a Screen

Just drop a file in `app/(customer)/myscreen.tsx`:
```tsx
export default function MyScreen() {
  return <View><Text>Hello</Text></View>;
}
```

Navigate with `router.push("/(customer)/myscreen")`. Auto-registered.

### 4.4 Calling Backend

Add a function to `lib/api.ts`:
```ts
export const apiMyEndpoint = (param: string) =>
  callBackend<{ result: any }>(`/myroute/${param}`);
```

Use in component:
```tsx
const r = await apiMyEndpoint("foo");
```

`callBackend` automatically adds `Authorization: Bearer <token>` if logged in.

---

## 5. DATABASE MIGRATIONS

**Dev mode** (SQLite, `file:./dev.db`):
```powershell
npm run prisma:push
```
Instant. No migration files. Loses history if you switch DBs.

**Production** (PostgreSQL — Neon/RDS):
```powershell
# Step 1: change provider
# In prisma/schema.prisma:
#   datasource db { provider = "postgresql" }

# Step 2: set DATABASE_URL in .env
# DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Step 3: create migration
npm run prisma:migrate -- --name init    # first time
# OR
npm run prisma:migrate -- --name add_credit_field    # subsequent

# Step 4: deploy migration to production
npm run prisma:deploy
```

Migration files end up in `prisma/migrations/`. **Commit them to git.**

---

## 6. API KEYS & INTEGRATIONS

### 6.1 Required `.env` File

`madat24-backend/.env` — **never commit this**. Use `.env.example` as template.

```bash
# ─── Server ────────────────────────────────────────
PORT=4000
NODE_ENV=development
JWT_SECRET=<run: openssl rand -hex 64>
JWT_EXPIRES_IN=30d
CORS_ORIGIN=             # empty = "*" (dev). Prod: comma-list of frontend origins
LOCAL_IP=192.168.1.14    # for phone testing

# ─── Database ──────────────────────────────────────
DATABASE_URL="file:./dev.db"     # SQLite for dev
# Prod: postgresql://user:pass@host/db?sslmode=require

# ─── Email OTP (signup verification + password reset) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=YOUR_GMAIL@gmail.com
SMTP_PASS=<Gmail App Password>     # myaccount.google.com → Security → App passwords
SMTP_FROM=Madat24 <noreply@madat24.in>

# ─── Phone OTP (Twilio) — optional ─────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE=+1...

# ─── Payments (Razorpay) — optional in dev ─────────
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# ─── Image Hosting (Cloudinary) — optional ─────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ─── AI Assistant (Anthropic Claude) ───────────────
ANTHROPIC_API_KEY=sk-ant-api03-...   # console.anthropic.com → API Keys
ANTHROPIC_MODEL=claude-haiku-4-5     # or claude-sonnet-4-6 for premium

# ─── Geo dispatch ───────────────────────────────────
NEARBY_RADIUS_KM=5

# ─── Rate limits ────────────────────────────────────
RATE_LIMIT_AUTH_MAX=30
RATE_LIMIT_OTP_MAX=5
RATE_LIMIT_JOBS_MAX=20

# ─── Error tracking — optional ──────────────────────
SENTRY_DSN=
```

### 6.2 Where to Get Each Key

| Service | URL | Purpose | Cost |
|---|---|---|---|
| **Anthropic** | console.anthropic.com → API Keys | AI Mechanic Helper | $5 free credit, then ₹0.10–0.30 per chat (Haiku) |
| **Gmail SMTP** | myaccount.google.com → Security → App passwords | Email OTP | Free, 500 emails/day limit. Use SendGrid for >500 |
| **Twilio** | console.twilio.com → Account → API keys | SMS OTP | ₹0.40 per SMS in India. Switch to **MSG91** (~₹0.15) for cheaper |
| **Razorpay** | dashboard.razorpay.com → Settings → API Keys | Payments | 2% per transaction |
| **Cloudinary** | cloudinary.com → Settings | Image hosting at scale | 25 GB free / month |
| **Neon Postgres** | console.neon.tech | Production DB | $0/mo for 0.5 GB, $19/mo for 10 GB |
| **Sentry** | sentry.io | Error tracking | Free 5K events/mo |
| **Expo EAS** | expo.dev | Build mobile apps | Free for 30 builds/mo |

### 6.3 SMTP Configuration (Critical for Email Verification)

Email OTP is **mandatory** for signup. Without configured SMTP, OTPs print to backend console (dev mode). Production setup:

**Gmail (free, 500/day limit):**
1. Enable 2FA on Google account
2. myaccount.google.com → Security → **App passwords** → Generate
3. Use 16-char password (no spaces) as `SMTP_PASS`

**SendGrid (production-grade, 100 free/day, then $19/mo for 50K):**
```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxxxx
SMTP_FROM=Madat24 <noreply@madat24.in>
```

---

## 7. RATING & REVIEW SYSTEM

### 7.1 How It Works

**Customer flow:**
1. Mechanic completes job → invoice generated
2. Customer pays via UPI/Cash/Credit → success screen
3. **"⭐ Rate Your Experience"** button shows
4. Modal: 5 stars + tag chips ("Quick Response", "Fair Price", etc.) + free-text review
5. On submit → `POST /api/reviews/:jobId`

**Backend logic:**
1. Validates: job must be `completed`, requester must be the customer, no existing review
2. Stores in `Review` table with rating, review text, tags (CSV)
3. **Recomputes mechanic's average rating** (`AVG`) and `totalRatings` count
4. Updates `MechanicProfile.rating` + `totalRatings`
5. **Notifies mechanic** via:
   - Socket.IO event `rating_received` (live in-app)
   - DB notification entry
   - **Push notification: "{N}-Star Review ⭐"**

**Mechanic side:**
- Profile screen shows updated `rating` and `reviewCount`
- Reviews tab lists all reviews with customer name, rating, tags, text
- Can respond to reviews (existing endpoint — `mechanicResponse` field on Review model)

### 7.2 Backend Endpoints

```
POST   /api/reviews/:jobId       # customer submits
GET    /api/reviews/mechanic/:id # list all reviews for a mechanic
```

### 7.3 Files Involved

- Backend: `src/routes/reviews.ts`
- Customer: `app/(customer)/dashboard.tsx` → `ReviewModal` component
- Customer: `lib/api.ts` → `apiSubmitReview`
- Mechanic: `app/(mechanic)/reviews.tsx` (review list view)
- Mechanic: `app/(mechanic)/profile.tsx` (rating display)

---

## 8. PUSH NOTIFICATIONS

### 8.1 Architecture

**Expo Push API** (chosen over raw FCM):
- ✅ No `google-services.json` / APNs cert needed
- ✅ Works in Expo Go AND production EAS builds
- ✅ Free, unlimited

### 8.2 What Gets Pushed

| Event | Recipient | Title |
|---|---|---|
| New job within 5km | Eligible mechanics | "New Job Request! 🔔" |
| Mechanic accepts | Customer | "Request Accepted! ✅" |
| Mechanic starts work | Customer | "Mechanic Started Work 🔧" |
| Job completed (invoice ready) | Customer | "Invoice Ready 📄" |
| Payment received | Mechanic | "Payment Received 💰" |
| Credit cleared (later payment) | Mechanic | "Credit Cleared 💚" |
| Customer used credit | Mechanic | "Customer used credit 📒" |
| Review received | Mechanic | "{N}-Star Review ⭐" |
| Job auto-expired (no acceptor) | Customer | "Request Expired ⌛" |

### 8.3 How It Wires

1. App login → `lib/push.ts` → `registerPushOnLogin()`
2. Asks notification permission → gets `ExponentPushToken[xxx]`
3. POSTs token to `/api/auth/fcm-token` (PATCH)
4. Backend stores in `User.fcmToken`
5. Any event → backend's `sendPushToUser(userId, payload)`:
   - Looks up user's token
   - POSTs to `https://exp.host/--/api/v2/push/send`
   - Auto-clears stale tokens on `DeviceNotRegistered`

### 8.4 Test Push

Real device only (won't work on simulators). Open both apps on real phones, log in. Backend logs will show fcmToken populated. Trigger any event → push appears.

---

## 9. END-TO-END TEST FLOW

After `npm run prisma:push` and ANTHROPIC_API_KEY added:

### Customer signup + book mechanic
1. Customer app → "Join the Network" → fill name/email/phone/password
2. **"Continue · Verify Email"** → check email/console for 6-digit OTP
3. Enter OTP → "Verify & Create Account" → dashboard
4. Tap **"🤖 AI Mechanic Helper"** → ask "tyre flat" → see structured diagnosis
5. Tap **"Book a Mechanic"** → request flow → submit
6. Mechanic app receives **push: "New Job Request! 🔔"**

### Mechanic accept + complete
1. Mechanic taps push → request screen → "Accept"
2. Customer receives **push: "Request Accepted! ✅"**
3. Live tracking map shows mechanic moving
4. Chat works in realtime
5. Mechanic taps "Start Work" → customer push "Mechanic Started Work 🔧"
6. Mechanic adds line items → "Generate Invoice"
7. Customer push "Invoice Ready 📄"

### Payment + Review
1. Customer dashboard → "Pay Now" → invoice details → "Choose Method"
2. **"Scan UPI QR Code"** → QR appears → scan with PhonePe → pay
3. Tap "I've Paid" → success → mechanic gets push "Payment Received 💰"
4. **"⭐ Rate Your Experience"** → 5 stars + tags + text → submit
5. Backend stores review, recomputes mechanic rating
6. Mechanic gets push "5-Star Review ⭐" → sees updated rating in profile

### Credit Flow (after 2 paid jobs)
1. Customer creates 3rd job, completes it
2. Pay screen → **"Pay Later (Credit)"** option now unlocked
3. Confirm dialog → "Yes, Use Credit"
4. Mechanic gets push "Customer used credit 📒"
5. Customer's next invoice → credit option locked with "Outstanding credit: INV-XXX"
6. Customer settles old credit → option unlocks again

---

## 10. PRODUCTION DEPLOYMENT

### 10.1 Backend → Railway (easiest)

```powershell
# 1. Push backend to GitHub
cd madat24-backend
git init
git add .
git commit -m "Initial backend"
gh repo create madat24-backend --private --source=. --push

# 2. Sign up at railway.app → New Project → Deploy from GitHub
# Select madat24-backend repo. Railway auto-detects Dockerfile.

# 3. Add Postgres in Railway dashboard
# Click Database → Add → PostgreSQL
# Copy DATABASE_URL from connection panel

# 4. Set env vars in Railway dashboard (from your .env, but rotated):
#   - DATABASE_URL  (auto-injected if you reference it)
#   - JWT_SECRET, ANTHROPIC_API_KEY, SMTP_*, etc.
#   - NODE_ENV=production
#   - CORS_ORIGIN=https://app.madat24.in,https://admin.madat24.in

# 5. Add a deploy command
# Railway will run: npm install && npm run build && npm start
# Add: PRE_DEPLOY="npm run prisma:deploy"   (runs migrations)

# 6. Verify
# Hit https://your-app.up.railway.app/health → should return { status: "running" }
```

**Alternatives:**
- **Render.com** — same workflow, slightly more generous free tier
- **AWS ECS / Fargate** — for >100K users, full control
- **DigitalOcean App Platform** — $5/mo, simpler than AWS

### 10.2 Mobile Apps → EAS Build

```powershell
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Sign up at expo.dev, link project
cd madat24-customer
eas login
eas build:configure       # creates eas.json

# 3. Update eas.json with production API URL
# (already templated — set API_URL to your Railway URL)
```

`eas.json` example:
```json
{
  "build": {
    "production": {
      "env": {
        "API_URL": "https://your-app.up.railway.app/api"
      },
      "android": { "buildType": "app-bundle" },
      "ios": { "simulator": false }
    }
  }
}
```

```powershell
# 4. Build Android (.aab for Play Store)
eas build --platform android --profile production

# 5. Build iOS (.ipa)
eas build --platform ios --profile production --auto-submit
```

### 10.3 Store Submission

**Google Play:**
1. play.google.com/console → $25 one-time fee
2. Create app → upload .aab → fill listing → submit for review (1–3 days)
3. Required: Privacy Policy URL, screenshots (1080×1920 ×3-5), feature graphic

**Apple App Store:**
1. developer.apple.com → $99/year
2. Create app in App Store Connect → upload .ipa via `eas submit`
3. Review takes 24–48 hours

### 10.4 Pre-deploy Checklist

- [ ] All leaked credentials **rotated**:
  - [ ] Neon DB password reset
  - [ ] JWT_SECRET regenerated (`openssl rand -hex 64`)
  - [ ] Anthropic API key (one for dev, one for prod)
  - [ ] Twilio token rotated
  - [ ] Cloudinary API secret rotated
  - [ ] Gmail App password regenerated
  - [ ] Firebase service account JSON regenerated
- [ ] `.env` files in **`.gitignore`** (never commit)
- [ ] `CORS_ORIGIN` set to actual frontend domains (not `*`)
- [ ] `prisma:migrate deploy` runs on every backend deploy
- [ ] Sentry DSN set, error tracking working
- [ ] Privacy Policy + Terms URLs live
- [ ] Both app icons + splash assets at full resolution
- [ ] Test signup → book → pay → review on a real phone with prod backend

---

## 11. SCALING GUIDE

### Phase 1: 0–1,000 Users (Current Setup)
- Backend: 1 Railway instance (~$5/mo)
- DB: Neon free tier (0.5 GB, 100 hrs/mo compute)
- SMS: Twilio pay-as-you-go (~₹500/mo)
- AI: Claude Haiku at ₹2,000/mo (10K chats)
- **Total: ~₹4,000/mo**

### Phase 2: 1,000–10,000 Users
**Bottlenecks at this scale:**
1. **OTP storage in DB** — slow under load. Move to Redis (`ioredis`)
2. **Socket.IO single instance** — can't scale horizontally without Redis adapter
3. **Multer local uploads** — server crash loses files. Switch to Cloudinary
4. **No background jobs** — SMS/email sends block requests. Add **BullMQ** queue

**Add to backend:**
```powershell
npm install ioredis @socket.io/redis-adapter bullmq
```

`src/redis.ts`:
```ts
import Redis from "ioredis";
export const redis = new Redis(process.env.REDIS_URL!);
```

`src/socket.ts` — replace memory adapter:
```ts
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "./redis";
const pubClient = redis.duplicate();
const subClient = redis.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

`src/queues.ts` — async work:
```ts
import { Queue, Worker } from "bullmq";
export const smsQueue = new Queue("sms", { connection: redis });
new Worker("sms", async (job) => {
  await sendTwilioSMS(job.data);
}, { connection: redis, concurrency: 5 });
```

**Cost at this phase: ~₹15,000/mo** (Railway $19, Redis $10, Neon $19, SMS, AI)

### Phase 3: 10K–100K Users
- **Read replicas** on Postgres (Neon Pro: $69/mo)
- **CDN** for image uploads (Cloudinary auto-CDN)
- **Sharded Socket.IO** behind a load balancer
- **Geographic dispatch indexing** — replace Haversine in-app math with PostGIS extension (`SELECT ST_DWithin(geom, point, 5000)`) — 100x faster
- **Monitoring**: Grafana + Prometheus, Sentry Performance
- **Background workers** scaled out as separate Railway services

**Cost: ~₹80,000/mo**

### Phase 4: 100K+ Users
- Move to AWS / GCP. Use:
  - ECS Fargate or GKE for containers
  - RDS Postgres Multi-AZ
  - ElastiCache Redis cluster
  - S3 + CloudFront for media
  - Pinpoint or SNS for push (replace Expo for true scale)
  - Pub/Sub for cross-service events
- Hire DevOps. Set up CI/CD properly (GitHub Actions → ECS).

---

## 12. SECURITY CHECKLIST

### Backend
- [ ] **JWT_SECRET ≥ 32 chars random** — `openssl rand -hex 64`
- [ ] **bcrypt rounds ≥ 10** for password hashing (already configured)
- [ ] **Rate limits** on `/auth/*` (signup, login), `/email/*`, `/sms/*` (already configured)
- [ ] **Zod validation** on every endpoint that accepts a body
- [ ] **Helmet** middleware for security headers (already configured)
- [ ] **CORS allowlist** — never `*` in production
- [ ] **HTTPS only** — Railway/Render provide this free
- [ ] **No secrets in logs** — already filtered in `logger.ts`

### Mobile Apps
- [ ] **Token in AsyncStorage** (not Keychain yet — upgrade to expo-secure-store for higher security)
- [ ] **Cert pinning** — for high-value apps (skip for now)
- [ ] **Obfuscation** — enable `expo-build-properties` Hermes minification (default in production)

### Data
- [ ] **No secrets in git** — `.env` always in `.gitignore`
- [ ] **No secrets in screenshots/chat logs**
- [ ] **DB backups** — Neon auto-backups, but configure retention
- [ ] **OTP TTL = 10 min** (already)
- [ ] **Reset token TTL = 15 min** (already)

### Operational
- [ ] **Rotate all leaked credentials before any production launch** (currently UNROTATED)
- [ ] **Sentry alerts** for errors > threshold
- [ ] **Uptime monitoring** — UptimeRobot.com (free, pings /health)
- [ ] **DDoS protection** — Cloudflare in front of Railway

---

## 13. COST ESTIMATES (INDIA, MONTHLY)

### Dev/Pre-launch (right now)
| Item | Cost |
|---|---|
| Local dev | ₹0 |
| Anthropic free credit | ₹0 (~10K queries) |
| Gmail SMTP | ₹0 (500/day) |
| **Total** | **₹0** |

### Soft Launch (100 users)
| Item | Cost |
|---|---|
| Railway backend | $5 (~₹420) |
| Neon Postgres | $0 (free tier) |
| SendGrid email | $0 (100/day) |
| Twilio SMS (200/mo) | ₹100 |
| Anthropic Haiku (1K chats) | ₹250 |
| Domain (madat24.in) | ₹100 |
| **Total** | **~₹900** |

### Growth (5,000 users, 500 jobs/day)
| Item | Cost |
|---|---|
| Railway 1 instance + Redis | $30 (~₹2,500) |
| Neon Pro Postgres | $19 (~₹1,600) |
| SendGrid Essentials | $19 (~₹1,600) |
| Twilio SMS (5K/mo) | ₹2,500 |
| Anthropic Haiku (50K chats) | ₹15,000 |
| Cloudinary | $0 (25 GB) |
| Razorpay (2% on ₹5L revenue) | ₹10,000 |
| **Total** | **~₹33,000** |

### Scale (50K users, 5K jobs/day)
| Item | Cost |
|---|---|
| AWS ECS + RDS + Redis + S3 | ~₹60,000 |
| MSG91 SMS (50K/mo @ ₹0.15) | ₹7,500 |
| Anthropic Haiku (500K chats) | ₹1,50,000 |
| Razorpay 2% | ₹1,00,000 |
| **Total** | **~₹3,20,000/mo** (revenue should be 5–10x this) |

---

## 14. TROUBLESHOOTING

### "Cannot reach the server"
- Backend running? Check `http://localhost:4000/health`
- Phone on same WiFi? Verify `LOCAL_IP` in `.env` matches `ipconfig`
- Firewall blocking 4000? Add inbound rule

### "Email OTP not arriving"
- Dev mode: OTP printed to backend console + returned in API response (`devOtp`)
- Prod: check spam folder, verify `SMTP_*` env vars, test with `nodemailer` test transport

### "Push notification not received"
- Real device only (not simulator/emulator)
- Permission granted? Check phone Settings → app → Notifications
- Token registered? Check backend log after login: `User.fcmToken` should populate
- Check `https://expo.dev/notifications` to manually send a test

### "Prisma client outdated"
```powershell
npm run prisma:generate
# restart npm run dev
```

### "AI Assistant returns 503"
- `ANTHROPIC_API_KEY` not set in `.env`
- Restart backend after editing `.env`

### "Build fails on EAS"
- Check `eas.json` env vars
- Make sure `app.config.js` exports correctly
- Sometimes need: `npx expo doctor` to verify

### "Map not showing live mechanic"
- Mechanic must be online (toggle in mechanic app)
- Backend `Socket.IO` connected? Check browser devtools → WS frames
- Customer must be in the active job context (job-details or dashboard active job card)

---

## 📞 Quick Reference Cards

### Run Everything Locally (one-shot)
```powershell
# Open 3 PowerShell windows:

# Window 1
cd D:\tan\PRODUCTION-APP\madat24-backend; npm run dev

# Window 2
cd D:\tan\PRODUCTION-APP\madat24-customer; npm start

# Window 3
cd D:\tan\PRODUCTION-APP\madat24-mechanic; npm start
```

### Update Backend After Code Changes
```powershell
cd D:\tan\PRODUCTION-APP\madat24-backend
npm run typecheck             # confirm no TS errors
npm run prisma:push           # if schema.prisma changed
# ts-node-dev auto-restarts on file save in dev
```

### Update Mobile Apps After Code Changes
- Save file → Metro auto-reloads in Expo Go
- For native module changes: `npx expo prebuild --clean` then rebuild

### Verify Production Backend Health
```powershell
curl https://your-app.up.railway.app/health
# Expected: { "status": "✅ running", "db": "connected", ... }
```

---

**Generated:** 2026-05-11 · **App version:** 2.0.0 · **MADAT24/7**
