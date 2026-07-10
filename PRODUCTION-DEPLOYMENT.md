# Madat24 Production Deployment

This branch is prepared for production with:

- PostgreSQL through Prisma migrations
- Email/mobile/password signup without OTP for the MVP
- Razorpay payments, or explicit demo payments for APK testing
- Cloudinary-backed uploads required in production
- EAS build profiles for customer and mechanic apps

## Backend Environment

Set these variables on your backend host:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=<64-byte-random-secret>
JWT_EXPIRES_IN=30d
CORS_ORIGIN=https://customer.madat24.com,https://mechanic.madat24.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-password-or-app-password>
SMTP_FROM=Madat24 <noreply@madat24.com>

TWILIO_ACCOUNT_SID=<sid>
TWILIO_AUTH_TOKEN=<token>
TWILIO_PHONE=<twilio-phone>

RAZORPAY_KEY_ID=<key-id>
RAZORPAY_KEY_SECRET=<key-secret>
ENABLE_DEMO_PAYMENTS=true

CLOUDINARY_CLOUD_NAME=<cloud-name>
CLOUDINARY_API_KEY=<api-key>
CLOUDINARY_API_SECRET=<api-secret>

SENTRY_DSN=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5
NEARBY_RADIUS_KM=5
RATE_LIMIT_AUTH_MAX=30
RATE_LIMIT_OTP_MAX=5
RATE_LIMIT_JOBS_MAX=20
```

Production startup intentionally refuses to boot if PostgreSQL, Cloudinary, JWT, or CORS are not configured.

For APK testing before payment onboarding, set `ENABLE_DEMO_PAYMENTS=true` and leave Razorpay keys empty. This makes payment endpoints auto-succeed and marks responses with demo mode fields. For real release builds, set Razorpay keys and change `ENABLE_DEMO_PAYMENTS=false`.

Signup no longer requires OTP. SMTP/Twilio can stay empty for this MVP, but forgot-password OTP email/SMS delivery will require those providers before public launch.

## Backend Deploy

From `madat24-backend`:

```powershell
npm ci
npm run prisma:generate
npm run build
npm run deploy:db
npm start
```

For Docker hosts, use `madat24-backend/Dockerfile`. The container runs:

```sh
npx prisma migrate deploy && node dist/index.js
```

## Mobile App Builds

Production builds use `https://api.madat24.com/api` from each app's `eas.json`.

Customer:

```powershell
cd madat24-customer
eas build -p android --profile production
eas build -p ios --profile production
```

Mechanic:

```powershell
cd madat24-mechanic
eas build -p android --profile production
eas build -p ios --profile production
```

Change the production `API_URL` values in both `eas.json` files if your deployed API uses a different domain.
