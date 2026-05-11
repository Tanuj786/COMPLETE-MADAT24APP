import "dotenv/config";
import { env, isProduction } from "./env";   // MUST be first import — validates env
import { log, initSentry } from "./logger";
import express from "express";
import http from "http";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import path from "path";

import { prisma } from "./prisma";
import { initSocket } from "./socket";
import { startScheduler, stopScheduler } from "./scheduler";
import { requestId, notFound, errorHandler } from "./middleware";

initSentry();

import authRoutes from "./routes/auth";
import emailRoutes from "./routes/email";
import smsRoutes from "./routes/sms";
import jobsRoutes from "./routes/jobs";
import mechanicRoutes from "./routes/mechanic";
import paymentsRoutes from "./routes/payments";
import chatRoutes from "./routes/chat";
import mediaRoutes from "./routes/media";
import reviewsRoutes from "./routes/reviews";
import notifsRoutes from "./routes/notifications";
import aiRoutes from "./routes/ai";

const PORT = env.PORT;

const app = express();
const server = http.createServer(app);

// ─── Middleware ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Production-safe CORS: explicit allowlist via env, "*" only in dev
const corsOrigins = env.CORS_ORIGIN
  ? env.CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean)
  : (isProduction ? [] : "*" as const);
app.use(cors({
  origin: corsOrigins as any,
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));   // shrunk from 10mb — image uploads use multipart
app.use(requestId);
app.use(morgan(isProduction ? "combined" : ":method :url :status :response-time ms reqId=:res[X-Request-Id]"));

// Serve uploaded files (chat images + media)
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// ─── Health (used by the app to detect backend availability) ────
app.get("/health", async (_req, res) => {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {}
  res.json({
    status: "✅ running",
    uptime: process.uptime(),
    db: dbOk ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

// ─── REST routes ─────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/sms", smsRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/mechanic", mechanicRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/notifications", notifsRoutes);
app.use("/api/ai", aiRoutes);

// 404
app.use(notFound);

// Final error handler
app.use(errorHandler);

// ─── Socket.IO ───────────────────────────────────────────────────
initSocket(server);

// ─── Rebroadcast scheduler (Uber-style continuous dispatch) ─────
startScheduler();

// ─── Listen ──────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  log.info(`Madat24 backend listening`, {
    port: PORT,
    env: env.NODE_ENV,
    db: env.DATABASE_URL.startsWith("file:") ? "sqlite" : "postgresql",
    corsOrigins,
  });
  if (!isProduction) {
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   API:    http://localhost:${PORT}/api`);
    console.log(`   From phone (same WiFi): use your PC's LAN IP (run \`ipconfig\` to find it)`);
  }
});

// Graceful shutdown
const shutdown = async () => {
  console.log("Shutting down...");
  stopScheduler();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
