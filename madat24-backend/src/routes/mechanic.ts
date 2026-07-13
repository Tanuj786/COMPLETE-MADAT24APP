import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../auth";
import { emitToUser, emitToJob } from "../socket";
import { RADIUS_KM, alertMechanic, broadcastJobTaken, haversineKm } from "../dispatch";
import { sendPushToUser } from "../push";
import { toServiceRequest } from "../jobPresenter";

const r = Router();

// All mechanic routes require MECHANIC role
r.use(requireAuth, requireRole("MECHANIC"));

const splitCsv = (s: string | null | undefined) => (s || "").split(",").map(x => x.trim()).filter(Boolean);

const parseNotificationData = (data: string | null) => {
  if (!data) return null;
  try {
    return JSON.parse(data) as { jobId?: string; distance?: number };
  } catch {
    return null;
  }
};

const splitServices = (s: string | null | undefined) =>
  (s || "").split(",").map(x => x.trim()).filter(Boolean);

async function alertPendingJobsForMechanic(mechanicUserId: string, latitude: number, longitude: number) {
  const profile = await prisma.mechanicProfile.findUnique({
    where: { userId: mechanicUserId },
    select: { services: true },
  });
  const services = splitServices(profile?.services);
  const jobs = await prisma.job.findMany({
    where: { status: "pending", mechanicId: null },
    select: { id: true, latitude: true, longitude: true, serviceType: true },
  });

  let alerted = 0;
  for (const job of jobs) {
    const distance = Number(haversineKm(latitude, longitude, job.latitude, job.longitude).toFixed(2));
    if (distance > RADIUS_KM) continue;
    if (services.length && !services.includes(job.serviceType)) continue;
    if (await alertMechanic(job.id, mechanicUserId, job.serviceType, distance)) alerted++;
  }
  return alerted;
}

r.get("/requests", async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.id, type: "job_request" },
    orderBy: { createdAt: "desc" },
  });

  const distances = new Map<string, number | undefined>();
  const jobIds = notifications
    .map(n => parseNotificationData(n.data))
    .filter((d): d is { jobId: string; distance?: number } => !!d?.jobId)
    .map(d => {
      distances.set(d.jobId, d.distance);
      return d.jobId;
    });

  if (!jobIds.length) return res.json({ requests: [] });

  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, status: "pending", mechanicId: null },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      media: true,
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    requests: jobs.map(job => toServiceRequest(job, distances.get(job.id))),
  });
});

// ─── POST /api/mechanic/requests/:id/accept ─────────────────────────
// Atomic claim — uses updateMany with WHERE status="pending" so two
// mechanics tapping accept at the same millisecond can't both win.
r.post("/requests/:id/accept", async (req, res) => {
  const claim = await prisma.job.updateMany({
    where: { id: req.params.id, status: "pending", mechanicId: null },
    data: {
      mechanicId: req.user!.id,
      status: "accepted",
      acceptedAt: new Date(),
      estimatedArrival: "10-15 min",
    },
  });

  if (claim.count === 0) {
    // Either job doesn't exist, or somebody else already won the race
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.status(409).json({ error: "Another mechanic just took this job", status: job.status });
  }

  const updated = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: {
      invoice: true,
      customer: { select: { id: true, name: true, phone: true } },
      media: true,
    },
  });
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { mechanicProfile: true },
  });

  // Notify the customer
  emitToUser(updated!.customerId, "job_accepted", {
    jobId: updated!.id,
    mechanic: me ? {
      id: me.id, name: me.name, phone: me.phone,
      shopName: me.mechanicProfile?.shopName || `${me.name}'s Shop`,
      rating: me.mechanicProfile?.rating || 0,
    } : null,
  });
  emitToJob(updated!.id, "job_accepted", { jobId: updated!.id });
  await prisma.notification.create({
    data: {
      userId: updated!.customerId,
      type: "job_accepted",
      title: "Request Accepted! ✅",
      message: `${me?.name || "A mechanic"} is on the way.`,
      data: JSON.stringify({ jobId: updated!.id }),
    },
  });
  sendPushToUser(updated!.customerId, {
    title: "Request Accepted! ✅",
    body: `${me?.name || "A mechanic"} is on the way.`,
    data: { jobId: updated!.id, type: "job_accepted" },
  });

  // Tell every other mechanic that was alerted that the job is gone
  await broadcastJobTaken(updated!.id, req.user!.id);

  res.json({ job: updated });
});

// ─── POST /api/mechanic/requests/:id/reject ─────────────────────────
r.post("/requests/:id/reject", async (req, res) => {
  // Soft-reject: just delete the matching notification for this mechanic.
  // Job stays "pending" so other mechanics can still pick it up.
  await prisma.notification.deleteMany({
    where: {
      userId: req.user!.id,
      type: "job_request",
      data: { contains: req.params.id },
    },
  });
  res.json({ ok: true });
});

// ─── PATCH /api/mechanic/jobs/:id/start ─────────────────────────────
r.patch("/jobs/:id/start", async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.mechanicId !== req.user!.id) return res.status(403).json({ error: "Not your job" });
  if (job.status !== "accepted") return res.status(400).json({ error: `Cannot start a ${job.status} job` });

  const updated = await prisma.job.update({
    where: { id: job.id },
    data: { status: "in-progress", startedAt: new Date() },
  });
  emitToUser(job.customerId, "job_started", { jobId: job.id });
  emitToJob(job.id, "job_started", { jobId: job.id });
  await prisma.notification.create({
    data: {
      userId: job.customerId,
      type: "job_started",
      title: "Mechanic Started Work 🔧",
      message: "Your mechanic has begun servicing your vehicle.",
      data: JSON.stringify({ jobId: job.id }),
    },
  });
  sendPushToUser(job.customerId, {
    title: "Mechanic Started Work 🔧",
    body: "Your mechanic has begun servicing your vehicle.",
    data: { jobId: job.id, type: "job_started" },
  });
  res.json({ job: updated });
});

// ─── PATCH /api/mechanic/jobs/:id/complete ──────────────────────────
r.patch("/jobs/:id/complete", async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.mechanicId !== req.user!.id) return res.status(403).json({ error: "Not your job" });
  if (job.status !== "in-progress") return res.status(400).json({ error: `Cannot complete a ${job.status} job` });

  const lineItems: Array<{ description: string; quantity: number; unitPrice: number; total: number }> = Array.isArray(req.body?.lineItems) ? req.body.lineItems : [];
  if (!lineItems.length) return res.status(400).json({ error: "At least one invoice line item is required." });

  const subtotal = lineItems.reduce((s, it) => s + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1), 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  const updated = await prisma.$transaction(async tx => {
    const j = await tx.job.update({
      where: { id: job.id },
      data: { status: "completed", completedAt: new Date() },
    });
    await tx.invoice.create({
      data: {
        jobId: job.id,
        invoiceNumber: `INV-${String(Date.now()).slice(-6)}`,
        lineItems: JSON.stringify(lineItems),
        subtotal, tax, total,
        paymentStatus: "pending",
      },
    });
    await tx.mechanicProfile.update({
      where: { userId: req.user!.id },
      data: { jobsCompleted: { increment: 1 } },
    });
    return j;
  });

  emitToUser(job.customerId, "job_completed", { jobId: job.id, total });
  emitToJob(job.id, "job_completed", { jobId: job.id, total });
  await prisma.notification.create({
    data: {
      userId: job.customerId,
      type: "payment_requested",
      title: "Invoice Ready 📄",
      message: `Service completed. Total ₹${total.toFixed(2)}`,
      data: JSON.stringify({ jobId: job.id }),
    },
  });
  sendPushToUser(job.customerId, {
    title: "Invoice Ready 📄",
    body: `Service completed. Total ₹${total.toFixed(2)}`,
    data: { jobId: job.id, type: "payment_requested" },
  });
  res.json({ job: updated });
});

// ─── GET /api/mechanic/jobs ─────────────────────────────────────────
r.get("/jobs", async (req, res) => {
  const jobs = await prisma.job.findMany({
    where: { mechanicId: req.user!.id },
    include: { invoice: true, customer: { select: { id: true, name: true, phone: true } }, media: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ jobs });
});

// ─── PATCH /api/mechanic/location ───────────────────────────────────
r.patch("/location", async (req, res) => {
  const { latitude, longitude, isOnline } = req.body || {};
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ error: "latitude and longitude required" });
  }
  await prisma.mechanicProfile.update({
    where: { userId: req.user!.id },
    data: { latitude, longitude, isOnline: !!isOnline, lastSeenAt: new Date() },
  });
  // Broadcast to anyone tracking this mechanic
  emitToUser(req.user!.id, "mechanic_location", { mechanicId: req.user!.id, latitude, longitude });
  const pendingJobsAlerted = isOnline ? await alertPendingJobsForMechanic(req.user!.id, latitude, longitude) : 0;
  res.json({ ok: true, pendingJobsAlerted });
});

// ─── PATCH /api/mechanic/online ─────────────────────────────────────
r.patch("/online", async (req, res) => {
  const { isOnline } = req.body || {};
  const profile = await prisma.mechanicProfile.update({
    where: { userId: req.user!.id },
    data: { isOnline: !!isOnline, lastSeenAt: new Date() },
  });
  const pendingJobsAlerted =
    isOnline && profile.latitude != null && profile.longitude != null
      ? await alertPendingJobsForMechanic(req.user!.id, profile.latitude, profile.longitude)
      : 0;
  res.json({ ok: true, isOnline: !!isOnline, pendingJobsAlerted });
});

// ─── GET /api/mechanic/profile ──────────────────────────────────────
r.get("/profile", async (req, res) => {
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    include: { mechanicProfile: true },
  });
  if (!me?.mechanicProfile) return res.status(404).json({ error: "Profile not found" });
  const p = me.mechanicProfile;
  const completedCount = await prisma.job.count({ where: { mechanicId: req.user!.id, status: "completed" } });
  const paidInvoices = await prisma.invoice.aggregate({
    where: { paymentStatus: "paid", job: { mechanicId: req.user!.id } },
    _sum: { total: true },
    _count: true,
  });
  const profile = {
    id: p.id,
    mechanicId: req.user!.id,
    shopName: p.shopName,
    description: p.description,
    location: { address: p.address, city: p.city, state: p.state, pincode: p.pincode },
    services: splitCsv(p.services),
    vehicleTypes: splitCsv(p.vehicleTypes),
    gstNumber: p.gstNumber,
    whatsappNumber: p.whatsappNumber,
    upiId: (p as any).upiId || null,
    hourlyRate: p.hourlyRate,
    yearsOfExperience: p.yearsOfExperience,
    rating: p.rating,
    reviewCount: p.totalRatings,
    responseRate: p.responseRate,
    completionRate: p.completionRate,
    isOnline: p.isOnline,
    profilePhoto: p.profilePhoto,
  };
  const metrics = {
    totalEarnings: paidInvoices._sum.total || 0,
    jobsCompleted: completedCount,
    averageRating: p.rating,
    reviewCount: p.totalRatings,
    responseRate: p.responseRate,
    completionRate: p.completionRate,
    customerSatisfaction: 95,
    earningsThisMonth: paidInvoices._sum.total || 0,
    earningsThisWeek: 0,
    jobsThisMonth: completedCount,
    jobsThisWeek: 0,
  };
  res.json({ profile, metrics });
});

// ─── PUT /api/mechanic/profile ──────────────────────────────────────
r.put("/profile", async (req, res) => {
  const b = req.body || {};
  const updated = await prisma.mechanicProfile.update({
    where: { userId: req.user!.id },
    data: {
      shopName: b.shopName ?? undefined,
      description: b.description ?? undefined,
      address: b.location?.address ?? b.address ?? undefined,
      city: b.location?.city ?? b.city ?? undefined,
      state: b.location?.state ?? b.state ?? undefined,
      pincode: b.location?.pincode ?? b.pincode ?? undefined,
      gstNumber: b.gstNumber ?? undefined,
      whatsappNumber: b.whatsappNumber ?? undefined,
      // Cast required until `prisma generate` regenerates types after schema change
      ...(typeof b.upiId === "string" ? { upiId: b.upiId.trim() || null } : {}) as any,
      hourlyRate: typeof b.hourlyRate === "number" ? b.hourlyRate : undefined,
      yearsOfExperience: typeof b.yearsOfExperience === "number" ? b.yearsOfExperience : undefined,
      services: Array.isArray(b.services) ? b.services.join(",") : undefined,
      vehicleTypes: Array.isArray(b.vehicleTypes) ? b.vehicleTypes.join(",") : undefined,
      profilePhoto: b.profilePhoto ?? undefined,
    },
  });
  res.json({ profile: updated });
});

export default r;
