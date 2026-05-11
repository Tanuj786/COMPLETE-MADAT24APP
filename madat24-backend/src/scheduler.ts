/**
 * Rebroadcast scheduler.
 *
 * Every REBROADCAST_INTERVAL_MS:
 *   1. For each pending job younger than EXPIRE_MS:
 *        find newly-eligible mechanics (in range, online, matching service)
 *        that have NOT been alerted yet → alert them.
 *   2. For each pending job older than EXPIRE_MS:
 *        mark it cancelled, notify the customer, clear pending notifications.
 */

import { prisma } from "./prisma";
import { emitToUser } from "./socket";
import { findEligibleMechanics, alertMechanic, getAlertedMechanicIds } from "./dispatch";
import { log } from "./logger";
import { sendPushToUser } from "./push";

const REBROADCAST_INTERVAL_MS = 30_000;   // every 30s
const EXPIRE_MS                = 5 * 60_000; // 5 min: pending jobs auto-cancel

let timer: NodeJS.Timeout | null = null;

async function tick() {
  try {
    const now = Date.now();
    const jobs = await prisma.job.findMany({
      where: { status: "pending" },
      select: {
        id: true, latitude: true, longitude: true, serviceType: true,
        customerId: true, requestedAt: true,
      },
    });

    for (const job of jobs) {
      const age = now - job.requestedAt.getTime();

      if (age > EXPIRE_MS) {
        // Expire it
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "cancelled", cancelledAt: new Date() },
        });
        await prisma.notification.create({
          data: {
            userId: job.customerId,
            type: "job_cancelled",
            title: "Request Expired ⌛",
            message: "No mechanics responded in time. Try again from the dashboard.",
            data: JSON.stringify({ jobId: job.id }),
          },
        });
        emitToUser(job.customerId, "job_cancelled", { jobId: job.id, reason: "expired" });
        sendPushToUser(job.customerId, {
          title: "Request Expired ⌛",
          body: "No mechanics responded in time. Try again from the dashboard.",
          data: { jobId: job.id, type: "job_cancelled" },
        });

        // Clear notifications for the candidate mechanics
        const alerted = await getAlertedMechanicIds(job.id);
        for (const userId of alerted) emitToUser(userId, "job_taken", { jobId: job.id });
        await prisma.notification.deleteMany({
          where: { type: "job_request", data: { contains: job.id } },
        });
        continue;
      }

      // Re-fan-out to newcomers
      const alreadyAlerted = new Set(await getAlertedMechanicIds(job.id));
      const eligible = await findEligibleMechanics(job.latitude, job.longitude, job.serviceType);
      for (const m of eligible) {
        if (alreadyAlerted.has(m.userId)) continue;
        await alertMechanic(job.id, m.userId, job.serviceType, m.distance);
      }
    }
  } catch (e: any) {
    log.error("scheduler tick failed", { error: e?.message || String(e) });
  }
}

export function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, REBROADCAST_INTERVAL_MS);
  setTimeout(tick, 5_000);
  log.info("scheduler started", {
    rebroadcastEvery: `${REBROADCAST_INTERVAL_MS / 1000}s`,
    expireAfter: `${EXPIRE_MS / 60000}min`,
  });
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
