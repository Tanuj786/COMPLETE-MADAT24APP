# Madat24 Backend

Node.js + Express + TypeScript + Prisma + Socket.IO + JWT.
Default DB: SQLite (zero install). Swap to PostgreSQL for production.

---

## Prerequisites
- **Node.js 18+** (download: https://nodejs.org)
- **VS Code** (recommended editor)

That's it. No Postgres, no Redis, no Docker required for dev.

---

## Setup (one-time)

Open VS Code → File → Open Folder → select `madat24-backend`.
Open the integrated terminal (` Ctrl+`` `) and run:

```powershell
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:push
```

`prisma:push` creates `prisma/dev.db` (SQLite file) with all tables.

---

## Run the dev server

```powershell
npm run dev
```

Expected output:
```
🚀 Madat24 Backend running on port 4000
   Health:  http://localhost:4000/health
   API:     http://localhost:4000/api
```

Verify in a browser: open `http://localhost:4000/health` — should return JSON with `"status":"✅ running"`.

---

## Connect from your phone (same WiFi)

1. Find your PC's IP:
   - Windows: `ipconfig` → look for `IPv4 Address . . . : 192.168.x.x`
   - Mac/Linux: `ifconfig | grep "inet "`
2. Open the app's `lib/api.ts` and set `BASE_URL = "http://<YOUR-PC-IP>:4000/api"`.
3. Make sure phone + PC are on the **same WiFi**.
4. Test from your phone's browser: `http://<YOUR-PC-IP>:4000/health` — must load.

If it doesn't load, your Windows Firewall is probably blocking port 4000. Allow it:
- Windows Defender Firewall → Allow an app → Add `node.exe`
- Or, dev-only: `New-NetFirewallRule -DisplayName "Madat24-Backend" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow`

---

## What works in dev mode (no API keys needed)

| Feature | Dev behavior |
|---|---|
| **Email OTP** | OTP returned in API response (`devOtp`) and printed to console |
| **SMS OTP** | OTP returned in API response (`devOtp`) and printed to console |
| **Razorpay** | `create-order` returns a fake order; `verify` auto-succeeds |
| **Image upload** | Saved locally to `uploads/` and served from `/uploads/...` |
| **Push notifications** | Not configured (use Socket.IO real-time events instead) |
| **Database** | SQLite file at `prisma/dev.db` |

To enable real services in production, fill in the matching keys in `.env`:
- `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` → real email OTP
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE` → real SMS OTP
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` → real Razorpay payments
- `CLOUDINARY_*` → cloud image hosting (currently uses local `uploads/`)

---

## Switching from SQLite → PostgreSQL (production)

1. Get a free Neon PostgreSQL DB at https://neon.tech.
2. In `.env`, set:
   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require"
   ```
3. In `prisma/schema.prisma` change:
   ```
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
4. Re-run:
   ```
   npm run prisma:generate
   npm run prisma:push
   ```

---

## Project layout

```
madat24-backend/
├── prisma/schema.prisma     ← DB schema (SQLite by default)
├── src/
│   ├── index.ts             ← Express + Socket.IO entry
│   ├── prisma.ts            ← PrismaClient singleton
│   ├── auth.ts              ← JWT helpers + middleware
│   ├── socket.ts            ← Socket.IO setup + emit helpers
│   └── routes/
│       ├── auth.ts          ← signup, login, /me
│       ├── email.ts         ← email OTP for forgot-password
│       ├── sms.ts           ← phone OTP for mechanic verification
│       ├── jobs.ts          ← customer jobs + nearby-mechanics
│       ├── mechanic.ts      ← accept/reject/start/complete + profile
│       ├── payments.ts      ← Razorpay + cash payment
│       ├── chat.ts          ← REST + Socket.IO real-time messaging
│       ├── media.ts         ← photo upload (local disk)
│       ├── reviews.ts       ← submit + fetch reviews
│       └── notifications.ts ← in-app notification CRUD
└── uploads/                 ← runtime-generated; gitignored
```

---

## Useful commands

```powershell
npm run dev               # Start with auto-restart on file changes
npm run build             # Compile to dist/
npm start                 # Run compiled output
npm run prisma:studio     # Open visual DB browser at http://localhost:5555
npm run prisma:push       # Apply schema changes to the DB
```

---

## Troubleshooting

- **Phone shows "Cannot connect to server"** → Wrong IP in `lib/api.ts`, or Windows Firewall is blocking port 4000.
- **`prisma: command not found`** → Run `npm install` again.
- **Port 4000 already in use** → Edit `.env`, set `PORT=4001`, restart.
- **Sockets not connecting** → That's okay; the app degrades gracefully to REST polling. Check the console for `[Socket] Connect error:` messages.
