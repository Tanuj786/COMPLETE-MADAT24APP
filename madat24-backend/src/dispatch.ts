/**
 * Dispatch logic shared between:
 *   - POST /api/jobs (initial fan-out to nearby mechanics)
 *   - PATCH /api/jobs/:id/location (re-fan-out when customer moves)
 *   - the rebroadcast scheduler (re-fan-out when new mechanics come online)
 *   - POST /api/mechanic/requests/:id/accept (atomic claim + losers broadcast)
 */

import { prisma } from "./prisma";
import { emitToUser } from "./socket";
import { env } from "./env";
import { sendPushToUser } from "./push";

export const RADIUS_KM = env.NEARBY_RADIUS_KM;

// Haversine distance in km between two lat/lng points
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const splitCsv = (s: string | null | undefined) =>
  (s || "").split(",").map(x => x.trim()).filter(Boolean);

export interface EligibleMechanic {
  userId: string;
  distance: number;
}

/**
 * Find all currently-online mechanics within RADIUS_KM of (lat, lng) whose
 * services list either includes the requested serviceType OR is empty
 * (an empty services list means "I accept anything").
 */
export async function findEligibleMechanics(
  lat: number,
  lng: number,
  serviceType: string,
): Promise<EligibleMechanic[]> {
  const profiles = await prisma.mechanicProfile.findMany({
    where: {
      isOnline: true,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: { userId: true, latitude: true, longitude: true, services: true },
  });
  const eligible: EligibleMechanic[] = [];
  for (const p of profiles) {
    const dist = haversineKm(lat, lng, p.latitude!, p.longitude!);
    if (dist > RADIUS_KM) continue;
    const services = splitCsv(p.services);
    if (services.length && !services.includes(serviceType)) continue;
    eligible.push({ userId: p.userId, distance: Number(dist.toFixed(2)) });
  }
  return eligible;
}

/**
 * Alert a single mechanic: socket emit + persistent notification.
 * Idempotent — if a job_request notification for this (mechanic, job)
 * already exists, we skip to avoid re-spamming the same user.
 */
export async function alertMechanic(
  jobId: string,
  mechanicUserId: string,
  serviceType: string,
  distance: number,
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: mechanicUserId,
      type: "job_request",
      data: { contains: jobId },
    },
  });
  if (existing) return false;

  await prisma.notification.create({
    data: {
      userId: mechanicUserId,
      type: "job_request",
      title: "New Request! 🔔",
      message: `${serviceType.replace(/-/g, " ")} • ${distance.toFixed(1)} km away`,
      data: JSON.stringify({ jobId, distance }),
    },
  });
  emitToUser(mechanicUserId, "new_job_request", { jobId, distance });
  sendPushToUser(mechanicUserId, {
    title: "New Job Request! 🔔",
    body: `${serviceType.replace(/-/g, " ")} • ${distance.toFixed(1)} km away — tap to accept`,
    data: { jobId, distance, type: "job_request" },
  });
  return true;
}

/** Returns the set of mechanic userIds we've ever alerted about this job. */
export async function getAlertedMechanicIds(jobId: string): Promise<string[]> {
  const notifs = await prisma.notification.findMany({
    where: { type: "job_request", data: { contains: jobId } },
    select: { userId: true },
  });
  return Array.from(new Set(notifs.map(n => n.userId)));
}

/**
 * Called after a mechanic atomically wins a job.
 * Tells every other previously-alerted mechanic the job is gone,
 * and removes their pending notifications so the bell badge clears.
 */
export async function broadcastJobTaken(jobId: string, winnerUserId: string) {
  const alerted = await getAlertedMechanicIds(jobId);
  const losers = alerted.filter(id => id !== winnerUserId);
  if (!losers.length) return;
  await prisma.notification.deleteMany({
    where: {
      userId: { in: losers },
      type: "job_request",
      data: { contains: jobId },
    },
  });
  for (const userId of losers) {
    emitToUser(userId, "job_taken", { jobId });
  }
}
