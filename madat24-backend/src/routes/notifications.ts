import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";

const r = Router();

r.get("/", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({
    notifications: notifications.map(n => ({
      id: n.id, userId: n.userId, type: n.type, title: n.title, message: n.message,
      read: n.read, createdAt: n.createdAt.toISOString(),
      data: n.data ? safeJson(n.data) : undefined,
    })),
  });
});

r.patch("/:id/read", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { read: true },
  });
  res.json({ ok: true });
});

r.patch("/read-all", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

r.delete("/", requireAuth, async (req, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user!.id } });
  res.json({ ok: true });
});

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return undefined; }
}

export default r;
