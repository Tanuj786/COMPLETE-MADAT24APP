import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";
import { verifyToken } from "../auth";
import { env, isAiConfigured } from "../env";
import { log } from "../logger";

const r = Router();

// Lazy-init the SDK so the server boots even when no key is set.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  return _client;
}

// Optional-auth middleware: attaches req.user if a valid token is sent,
// but does NOT block the request when no token is present (guest mode).
function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token && !token.startsWith("local_")) {
    try { req.user = verifyToken(token); } catch { /* ignore — treat as guest */ }
  }
  next();
}

// Logged-in users: 20 messages per minute. Plenty for real diagnostics.
const aiLimiterAuth = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user!.id,
  message: { error: "Slow down — try again in a minute" },
});

// Guests (pre-signup): tighter cap to prevent abuse of free Claude calls.
// 5 per minute, 30 per day (rolling) per IP.
const aiLimiterGuestBurst = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `guest:burst:${req.ip}`,
  message: { error: "Slow down — sign up to chat freely.", guestLimit: true },
});
const aiLimiterGuestDaily = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `guest:daily:${req.ip}`,
  message: { error: "Daily AI free limit reached — sign up for unlimited diagnostics.", guestLimit: true },
});

// Apply the right limiter based on whether the request is authenticated
function aiLimiter(req: Request, res: Response, next: NextFunction) {
  if (req.user) return aiLimiterAuth(req, res, next);
  // Guest path: burst limit first, then daily limit
  return aiLimiterGuestBurst(req, res, (err?: any) => {
    if (err) return next(err);
    if (res.headersSent) return;
    return aiLimiterGuestDaily(req, res, next);
  });
}

const SYSTEM_PROMPT = `You are MADAT24/7's in-app Automobile Assistant for Indian drivers (cars, bikes, EVs, scooters). The user is stuck somewhere with a vehicle problem and needs FAST help.

Always reply in the EXACT JSON format below — no prose outside the JSON, no markdown fences.

{
  "summary": "<one short sentence diagnosis in plain English / mild Hinglish>",
  "severity": "low" | "medium" | "high",
  "steps": ["<safe step 1>", "<safe step 2>", "<safe step 3>"],
  "needsMechanic": true | false,
  "suggestedService": "tyre-puncture" | "fuel-delivery" | "engine-repair" | "brake-repair" | "battery-jump-start" | "towing-services" | "oil-change" | "ac-repair" | null,
  "estimatedCostINR": { "min": <int>, "max": <int> } | null,
  "warning": "<safety warning if any, else empty string>"
}

Rules:
- 'high' severity = unsafe to drive (brake failure, engine seized, fuel leak, smoke, accident damage). Always set needsMechanic=true and include a warning.
- 'medium' = drivable short distance but needs attention soon (battery weak, AC out, slow puncture, oil leak).
- 'low' = self-fix possible (loose cap, light bulb out, clean filter).
- 'steps' must be 2-4 items, each safe for an untrained driver. Never recommend opening the engine block, electrical work on a hot car, or touching brake fluid.
- 'suggestedService' MUST be one of the 8 enum values above or null. Match the closest service.
- Costs are rough Indian market estimates in INR. Use null if unknown.
- Prefer Hinglish ("petrol khatam ho gaya", "battery weak hai") for natural feel, but keep technical terms in English.
- Never invent vehicle-specific part numbers or brand-specific instructions.`;

type Msg = { role: "user" | "assistant"; content: string };

// ─── GET /api/ai/status ───────────────────────────────────────────
r.get("/status", (_req, res) => {
  res.json({ configured: isAiConfigured, model: env.ANTHROPIC_MODEL });
});

// ─── POST /api/ai/chat ────────────────────────────────────────────
// Available to both logged-in users and guests (pre-signup).
// Guests get a tighter rate limit; see middleware above.
r.post("/chat", optionalAuth, aiLimiter, async (req, res) => {
  if (!isAiConfigured) {
    return res.status(503).json({
      error: "AI assistant not configured. Backend needs ANTHROPIC_API_KEY.",
      configured: false,
    });
  }

  const messages: Msg[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length) return res.status(400).json({ error: "messages array required" });

  // Sanitize: only keep user/assistant roles, trim long content
  const cleanMessages = messages
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)  // last 12 turns max — keeps context tight
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== "user") {
    return res.status(400).json({ error: "last message must be from user" });
  }

  try {
    const response = await client().messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" }, // cache the system prompt — saves tokens across turns
        },
      ],
      messages: cleanMessages,
    });

    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    const raw = textBlock?.text?.trim() || "";

    let structured: any = null;
    try {
      // Attempt to parse the model's JSON. Strip code fences if present.
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      structured = JSON.parse(cleaned);
    } catch {
      // Model returned non-JSON — pass through as a plain message
      structured = null;
    }

    res.json({
      message: structured?.summary || raw,
      structured,
      usage: {
        input: response.usage?.input_tokens,
        output: response.usage?.output_tokens,
        cacheRead: (response.usage as any)?.cache_read_input_tokens,
      },
    });
  } catch (err: any) {
    log.error("AI chat error", { msg: err?.message, status: err?.status });
    const isAuthErr = err?.status === 401 || err?.status === 403;
    res.status(502).json({
      error: isAuthErr ? "AI key invalid" : "AI service unavailable",
      retryable: !isAuthErr,
    });
  }
});

export default r;
