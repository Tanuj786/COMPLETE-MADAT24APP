import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { emitToJob } from "../socket";

const r = Router();

// ─── Multer setup for chat image attachments ──────────────────────
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "chat");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

async function assertJobAccess(jobId: string, userId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.customerId !== userId && job.mechanicId !== userId) return null;
  return job;
}

// ─── GET /api/chat/:jobId ─────────────────────────────────────────
r.get("/:jobId", requireAuth, async (req, res) => {
  const job = await assertJobAccess(req.params.jobId, req.user!.id);
  if (!job) return res.status(404).json({ error: "Job not found / not yours" });
  const messages = await prisma.chatMessage.findMany({
    where: { jobId: req.params.jobId },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true } } },
  });
  res.json({
    messages: messages.map(m => ({
      id: m.id, jobId: m.jobId,
      senderId: m.senderId, senderName: m.sender.name,
      senderRole: m.senderRole, text: m.text, imageUrl: m.imageUrl,
      read: m.read, createdAt: m.createdAt.toISOString(),
    })),
  });
});

// ─── POST /api/chat/:jobId ────────────────────────────────────────
r.post("/:jobId", requireAuth, async (req, res) => {
  const job = await assertJobAccess(req.params.jobId, req.user!.id);
  if (!job) return res.status(404).json({ error: "Job not found / not yours" });
  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });

  const senderRole = job.customerId === req.user!.id ? "customer" : "mechanic";
  const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const msg = await prisma.chatMessage.create({
    data: { jobId: job.id, senderId: req.user!.id, senderRole, text },
  });
  const payload = {
    id: msg.id, jobId: msg.jobId,
    senderId: msg.senderId, senderName: me?.name || "",
    senderRole: msg.senderRole, text: msg.text, imageUrl: msg.imageUrl,
    read: false, createdAt: msg.createdAt.toISOString(),
  };
  emitToJob(job.id, "new_message", payload);
  res.json({ message: payload });
});

// ─── POST /api/chat/:jobId/image ──────────────────────────────────
r.post("/:jobId/image", requireAuth, upload.single("image"), async (req, res) => {
  const job = await assertJobAccess(req.params.jobId, req.user!.id);
  if (!job) return res.status(404).json({ error: "Job not found / not yours" });
  if (!req.file) return res.status(400).json({ error: "image file required" });

  const url = `/uploads/chat/${req.file.filename}`;
  const senderRole = job.customerId === req.user!.id ? "customer" : "mechanic";
  const me = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const msg = await prisma.chatMessage.create({
    data: { jobId: job.id, senderId: req.user!.id, senderRole, text: "[image]", imageUrl: url },
  });
  const payload = {
    id: msg.id, jobId: msg.jobId,
    senderId: msg.senderId, senderName: me?.name || "",
    senderRole: msg.senderRole, text: msg.text, imageUrl: url,
    read: false, createdAt: msg.createdAt.toISOString(),
  };
  emitToJob(job.id, "new_message", payload);
  res.json({ message: payload });
});

export default r;
