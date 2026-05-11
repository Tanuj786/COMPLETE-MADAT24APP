import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";

const r = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "media");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || ".jpg";
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

// POST /api/media/:jobId  (multipart: file, category)
r.post("/:jobId", requireAuth, upload.single("file"), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.customerId !== req.user!.id && job.mechanicId !== req.user!.id) {
    return res.status(403).json({ error: "Not your job" });
  }
  if (!req.file) return res.status(400).json({ error: "file is required" });

  const category = String(req.body?.category || "customer");
  const url = `/uploads/media/${req.file.filename}`;
  const m = await prisma.media.create({
    data: {
      jobId: job.id,
      uploadedBy: req.user!.id,
      category,
      url,
      mimeType: req.file.mimetype || "image/jpeg",
    },
  });
  res.json({ media: { id: m.id, url, category, uploadedAt: m.uploadedAt.toISOString() } });
});

export default r;
