import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../auth";
import { emitToUser } from "../socket";
import { sendPushToUser } from "../push";

const r = Router();

// POST /api/reviews/:jobId — customer submits a review
r.post("/:jobId", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your job" });
  if (job.status !== "completed") return res.status(400).json({ error: "Can only review completed jobs" });
  if (!job.mechanicId) return res.status(400).json({ error: "Job has no mechanic" });

  const rating = Number(req.body?.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: "Rating must be 1-5" });
  const review = String(req.body?.review || "").trim();
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.join(",") : "";

  const existing = await prisma.review.findUnique({ where: { jobId: job.id } });
  if (existing) return res.status(409).json({ error: "Already reviewed" });

  const r1 = await prisma.review.create({
    data: { jobId: job.id, customerId: req.user!.id, mechanicId: job.mechanicId, rating, review, tags },
  });

  // Recompute mechanic's rating average
  const agg = await prisma.review.aggregate({
    where: { mechanicId: job.mechanicId },
    _avg: { rating: true }, _count: true,
  });
  await prisma.mechanicProfile.update({
    where: { userId: job.mechanicId },
    data: { rating: agg._avg.rating || 0, totalRatings: agg._count },
  });

  emitToUser(job.mechanicId, "rating_received", { jobId: job.id, rating, review });
  await prisma.notification.create({
    data: {
      userId: job.mechanicId,
      type: "rating_received",
      title: `${rating}-Star Review ⭐`,
      message: review || "New review received",
      data: JSON.stringify({ jobId: job.id }),
    },
  });
  sendPushToUser(job.mechanicId, {
    title: `${rating}-Star Review ⭐`,
    body: review || "New review received",
    data: { jobId: job.id, type: "rating_received" },
  });

  res.json({ review: r1 });
});

// GET /api/reviews/mechanic/:mechanicId
r.get("/mechanic/:mechanicId", requireAuth, async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { mechanicId: req.params.mechanicId },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    reviews: reviews.map(rv => ({
      id: rv.id, jobId: rv.jobId,
      customerId: rv.customerId, customerName: rv.customer.name,
      mechanicId: rv.mechanicId, rating: rv.rating, review: rv.review,
      tags: (rv.tags || "").split(",").filter(Boolean),
      mechanicResponse: rv.mechanicResponse,
      mechanicResponseAt: rv.mechanicResponseAt?.toISOString(),
      createdAt: rv.createdAt.toISOString(),
    })),
  });
});

export default r;
