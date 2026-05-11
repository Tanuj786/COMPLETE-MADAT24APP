/**
 * Tiny structured logger — JSON in production, pretty in dev.
 * No external dependency to keep the surface area small.
 */

import { env, isProduction } from "./env";

type Level = "debug" | "info" | "warn" | "error";

const COLOR: Record<Level, string> = {
  debug: "\x1b[90m",
  info:  "\x1b[36m",
  warn:  "\x1b[33m",
  error: "\x1b[31m",
};
const RESET = "\x1b[0m";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (isProduction) {
    process.stdout.write(JSON.stringify({ ts, level, msg, ...fields }) + "\n");
  } else {
    const tag = `${COLOR[level]}${level.toUpperCase().padEnd(5)}${RESET}`;
    let line = `${ts} ${tag} ${msg}`;
    if (fields && Object.keys(fields).length) line += " " + JSON.stringify(fields);
    process.stdout.write(line + "\n");
  }
}

export const log = {
  debug: (msg: string, f?: Record<string, unknown>) => emit("debug", msg, f),
  info:  (msg: string, f?: Record<string, unknown>) => emit("info", msg, f),
  warn:  (msg: string, f?: Record<string, unknown>) => emit("warn", msg, f),
  error: (msg: string, f?: Record<string, unknown>) => emit("error", msg, f),
};

// Optional Sentry init — no-op if SENTRY_DSN absent.
// Lazy-required so the package only needs to be installed if you actually use it.
export function initSentry() {
  if (!env.SENTRY_DSN) return;
  try {
    // Lazy require so this is optional.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require("@sentry/node");
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
    log.info("sentry initialized");
  } catch (e: any) {
    log.warn("sentry not available — install @sentry/node to enable", { error: e.message });
  }
}
