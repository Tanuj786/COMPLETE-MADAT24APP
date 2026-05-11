import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { ZodSchema } from "zod";
import crypto from "crypto";
import { env } from "./env";
import { log } from "./logger";

// ─── Request ID ──────────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request { reqId?: string }
  }
}

export function requestId(req: Request, res: Response, next: NextFunction) {
  req.reqId = crypto.randomBytes(6).toString("hex");
  res.setHeader("X-Request-Id", req.reqId);
  next();
}

// ─── Rate limiters ───────────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please wait a few minutes and try again." },
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_OTP_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many OTP requests. Please wait a minute." },
});

export const jobsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_JOBS_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many job requests. Please wait a moment." },
});

// ─── Zod validator ───────────────────────────────────────────────
// Usage: router.post("/path", validate(MySchema), handler)
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({
        error: `${issue.path.join(".") || "body"}: ${issue.message}`,
        details: parsed.error.issues,
      });
    }
    req.body = parsed.data;
    next();
  };
}

// ─── 404 + error handler ─────────────────────────────────────────
export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}`, reqId: req.reqId });
}

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err?.status || err?.statusCode || 500;
  const msg = err?.message || "Internal server error";
  log.error("request failed", { reqId: req.reqId, status, msg, path: req.path });
  res.status(status).json({ error: msg, reqId: req.reqId });
}
