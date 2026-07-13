import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../auth";
import { emitToUser, emitToJob } from "../socket";
import { jobsLimiter, validate } from "../middleware";
import { CreateJobSchema, UpdateLocationSchema } from "../schemas";
import {
  RADIUS_KM, haversineKm,
  findEligibleMechanics, alertMechanic, getAlertedMechanicIds,
} from "../dispatch";

const r = Router();

const splitCsv = (s: string | null | undefined) => (s || "").split(",").map(x => x.trim()).filter(Boolean);

// ─── GET /api/jobs/nearby-mechanics ─────────────────────────────────
// Customer-facing search: who's currently online + in range right now?
r.get("/nearby-mechanics", requireAuth, async (req, res) => {
  const lat = Number(req.query.latitude);
  const lng = Number(req.query.longitude);
  if (!isFinite(lat) || !isFinite(lng)) return res.status(400).json({ error: "latitude/longitude required" });

  const profiles = await prisma.mechanicProfile.findMany({
    where: { isOnline: true, latitude: { not: null }, longitude: { not: null } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  });

  const enriched = profiles
    .map(p => {
      const dist = haversineKm(lat, lng, p.latitude!, p.longitude!);
      return {
        id: p.user.id,
        name: p.user.name,
        phone: p.user.phone,
        shopName: p.shopName,
        rating: p.rating,
        totalRatings: p.totalRatings,
        isVerified: p.isVerified,
        profilePhoto: p.profilePhoto,
        vehicleTypes: splitCsv(p.vehicleTypes),
        services: splitCsv(p.services),
        dist: Number(dist.toFixed(2)),
        eta: `${Math.max(2, Math.round(dist * 4))} min`,
        latitude: p.latitude!,
        longitude: p.longitude!,
      };
    })
    .filter(m => m.dist <= RADIUS_KM)
    .sort((a, b) => a.dist - b.dist);

  res.json({ mechanics: enriched, total: enriched.length });
});

// ─── POST /api/jobs ─────────────────────────────────────────────────
// Customer creates a service request and we fan it out to nearby mechanics.
r.post("/", requireAuth, requireRole("CUSTOMER"), jobsLimiter, validate(CreateJobSchema), async (req, res) => {
  const b = req.body;
  const job = await prisma.job.create({
    data: {
      customerId: req.user!.id,
      serviceType: b.serviceType,
      vehicleType: b.vehicleType,
      vehicleMake: b.vehicleMake || null,
      vehicleModel: b.vehicleModel || null,
      vehicleYear: b.vehicleYear || null,
      licensePlate: b.licensePlate || null,
      address: b.address,
      city: b.city,
      state: b.state || null,
      pincode: b.pincode || null,
      latitude: b.latitude,
      longitude: b.longitude,
      description: b.description || null,
      estimatedMin: b.estimatedMin ?? null,
      estimatedMax: b.estimatedMax ?? null,
      status: "pending",
    },
  });

  const eligible = await findEligibleMechanics(job.latitude, job.longitude, job.serviceType);
  let alerted = 0;
  for (const m of eligible) {
    if (await alertMechanic(job.id, m.userId, job.serviceType, m.distance)) alerted++;
  }
  res.json({ job, mechanicsAlerted: alerted });
});

// ─── GET /api/jobs ──────────────────────────────────────────────────
r.get("/", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: { customerId: req.user!.id },
    include: {
      invoice: true,
      customer: { select: { id: true, name: true, phone: true } },
      mechanic: {
        select: {
          id: true,
          name: true,
          phone: true,
          mechanicProfile: true,
        },
      },
      media: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ jobs });
});

// ─── GET /api/jobs/:id ──────────────────────────────────────────────
r.get("/:id", requireAuth, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { invoice: true, mechanic: true, customer: true, media: true, chatMessages: true },
  });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.customerId !== req.user!.id && job.mechanicId !== req.user!.id) {
    return res.status(403).json({ error: "Not your job" });
  }
  res.json({ job });
});

// ─── PATCH /api/jobs/:id/cancel ─────────────────────────────────────
r.patch("/:id/cancel", requireAuth, requireRole("CUSTOMER"), async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your job" });
  if (!["pending", "accepted"].includes(job.status)) {
    return res.status(400).json({ error: `Cannot cancel a ${job.status} job` });
  }
  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { status: "cancelled", cancelledAt: new Date() },
  });
  // Tell anyone alerted (or the assigned mechanic) the job is dead
  const alerted = await getAlertedMechanicIds(job.id);
  for (const userId of alerted) emitToUser(userId, "job_taken", { jobId: job.id });
  if (job.mechanicId) emitToUser(job.mechanicId, "job_cancelled", { jobId: job.id });
  await prisma.notification.deleteMany({
    where: { type: "job_request", data: { contains: job.id } },
  });
  res.json({ job: updated });
});

// ─── PATCH /api/jobs/:id/location ───────────────────────────────────
// Customer reports a location update (e.g. they're sitting in a moving car).
// While the job is pending we re-fan-out to any mechanics that came into range.
// Once accepted we just notify the assigned mechanic so the live map stays fresh.
r.patch("/:id/location", requireAuth, requireRole("CUSTOMER"), validate(UpdateLocationSchema), async (req, res) => {
  const { latitude: lat, longitude: lng } = req.body;
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your job" });
  if (["completed", "cancelled"].includes(job.status)) return res.status(400).json({ error: `Job is ${job.status}` });

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { latitude: lat, longitude: lng },
  });

  let newlyAlerted = 0;
  if (updated.status === "pending") {
    const eligible = await findEligibleMechanics(lat, lng, updated.serviceType);
    for (const m of eligible) {
      if (await alertMechanic(updated.id, m.userId, updated.serviceType, m.distance)) newlyAlerted++;
    }
  } else if (updated.mechanicId) {
    emitToUser(updated.mechanicId, "customer_location", { jobId: updated.id, latitude: lat, longitude: lng });
  }
  res.json({ ok: true, mechanicsAlerted: newlyAlerted });
});

export default r;
