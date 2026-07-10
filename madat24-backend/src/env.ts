/**
 * Environment validation. Loaded once at boot.
 * In production, refuses to start with weak / missing secrets.
 */

import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const Schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("30d"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // CORS allowlist (comma-separated) — empty = "*" (dev only)
  CORS_ORIGIN: z.string().default(""),

  // Optional integrations
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Madat24 <noreply@madat24.local>"),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  ENABLE_DEMO_PAYMENTS: z.coerce.boolean().default(false),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  // Anthropic Claude API for the in-app AI Automobile Assistant
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),

  NEARBY_RADIUS_KM: z.coerce.number().positive().default(5),

  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_OTP_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_JOBS_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   ${issue.path.join(".")}: ${issue.message}`);
  }
  console.error("\nFix the above in your .env then restart.\n");
  process.exit(1);
}

export const env = parsed.data;

// ─── Production safety checks ────────────────────────────────────
if (env.NODE_ENV === "production") {
  const errs: string[] = [];

  // Default dev secrets must not ship to prod
  if (
    env.JWT_SECRET === "dev-only-secret-change-me-in-production" ||
    env.JWT_SECRET === "dev-only-secret-change-me" ||
    env.JWT_SECRET.length < 32
  ) {
    errs.push("JWT_SECRET must be set to a strong (≥32 char) random value in production. Generate one with: openssl rand -hex 64");
  }
  if (env.DATABASE_URL.startsWith("file:")) {
    errs.push("DATABASE_URL cannot use SQLite (file:) in production. Use PostgreSQL — e.g. Neon: postgresql://user:pass@host/db?sslmode=require");
  }
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN === "*") {
    errs.push("CORS_ORIGIN must be a comma-separated allowlist in production (e.g. https://app.madat24.com,https://admin.madat24.com).");
  }
  if (!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) && !env.ENABLE_DEMO_PAYMENTS) {
    errs.push("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required in production unless ENABLE_DEMO_PAYMENTS=true for APK testing.");
  }
  if (!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)) {
    errs.push("CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are required in production so uploaded photos survive deploys.");
  }

  if (errs.length) {
    console.error("\n❌ Production safety checks failed:\n");
    for (const e of errs) console.error("   • " + e);
    console.error("\nRefusing to start. Fix .env and try again.\n");
    process.exit(1);
  }
}

// Helper for code that needs to know whether an integration is configured
export const isEmailConfigured  = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
export const isSmsConfigured    = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE);
export const isRzpConfigured    = !!(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
export const isAiConfigured     = !!env.ANTHROPIC_API_KEY;
export const isCloudinaryConfigured = !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
export const isProduction       = env.NODE_ENV === "production";
