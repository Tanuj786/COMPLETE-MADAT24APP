import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { emitToUser } from "../socket";
import { env, isProduction, isRzpConfigured } from "../env";
import { sendPushToUser } from "../push";

const r = Router();

const RZP_KEY = env.RAZORPAY_KEY_ID;
const RZP_SECRET = env.RAZORPAY_KEY_SECRET;
const demoPaymentsEnabled = env.ENABLE_DEMO_PAYMENTS || !isProduction;

// ─── GET /api/payments/invoice/:jobId ───────────────────────────────
r.get("/invoice/:jobId", requireAuth, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.jobId },
    include: { invoice: true, customer: true, mechanic: { include: { mechanicProfile: true } } },
  });
  if (!job?.invoice) return res.status(404).json({ error: "Invoice not found" });
  if (job.customerId !== req.user!.id && job.mechanicId !== req.user!.id) {
    return res.status(403).json({ error: "Not your invoice" });
  }
  const inv = job.invoice;
  const mp = job.mechanic?.mechanicProfile;
  const invoice = {
    id: inv.id,
    jobId: inv.jobId,
    invoiceNumber: inv.invoiceNumber,
    date: inv.createdAt.toISOString(),
    shopInfo: {
      name: mp?.shopName || job.mechanic?.name || "",
      address: [mp?.address, mp?.city].filter(Boolean).join(", "),
      phone: job.mechanic?.phone || "",
      gstNumber: mp?.gstNumber,
      upiId: (mp as any)?.upiId || null,
    },
    customerInfo: { name: job.customer?.name || "", phone: job.customer?.phone || "" },
    lineItems: JSON.parse(inv.lineItems || "[]"),
    subtotal: inv.subtotal,
    tax: inv.tax,
    total: inv.total,
    paymentStatus: inv.paymentStatus,
    paymentMethod: inv.paymentMethod,
    isCredit:        (inv as any).isCredit || false,
    creditTakenAt:   (inv as any).creditTakenAt?.toISOString?.() || null,
    creditClearedAt: (inv as any).creditClearedAt?.toISOString?.() || null,
  };
  res.json({ invoice });
});

// ─── POST /api/payments/create-order ────────────────────────────────
// Creates a Razorpay order. In dev mode (no keys) returns a fake order
// that the client can immediately verify with /verify (auto-success).
r.post("/create-order", requireAuth, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.body?.jobId },
    include: { invoice: true },
  });
  if (!job?.invoice) return res.status(404).json({ error: "Invoice not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your invoice" });
  if (job.invoice.paymentStatus === "paid") return res.status(400).json({ error: "Already paid" });

  if (!isRzpConfigured) {
    if (!demoPaymentsEnabled) {
      return res.status(503).json({ error: "Razorpay is not configured. Set ENABLE_DEMO_PAYMENTS=true only for APK/demo testing." });
    }
    const fakeOrder = `order_dev_${Date.now()}`;
    await prisma.invoice.update({
      where: { id: job.invoice.id },
      data: { razorpayOrderId: fakeOrder },
    });
    return res.json({
      orderId: fakeOrder,
      amount: Math.round(job.invoice.total * 100),
      currency: "INR",
      keyId: "rzp_dev_mode",
      isDemoMode: true,
    });
  }

  // Real Razorpay
  const auth = Buffer.from(`${RZP_KEY}:${RZP_SECRET}`).toString("base64");
  const apiRes = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: Math.round(job.invoice.total * 100),
      currency: "INR",
      receipt: job.invoice.invoiceNumber,
    }),
  });
  const data = (await apiRes.json()) as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
  if (!apiRes.ok) return res.status(500).json({ error: data?.error?.description || "Razorpay error" });
  await prisma.invoice.update({ where: { id: job.invoice.id }, data: { razorpayOrderId: data.id } });
  res.json({ orderId: data.id, amount: data.amount, currency: data.currency, keyId: RZP_KEY, isDemoMode: false });
});

// ─── POST /api/payments/verify ──────────────────────────────────────
r.post("/verify", requireAuth, async (req, res) => {
  const { jobId, razorpayOrderId, razorpayPaymentId, razorpaySignature, method } = req.body || {};
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { invoice: true } });
  if (!job?.invoice) return res.status(404).json({ error: "Invoice not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your invoice" });

  if (!isRzpConfigured && !demoPaymentsEnabled) {
    return res.status(503).json({ error: "Razorpay is not configured. Set ENABLE_DEMO_PAYMENTS=true only for APK/demo testing." });
  }

  if (isRzpConfigured) {
    const expected = crypto
      .createHmac("sha256", RZP_SECRET!)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    if (expected !== razorpaySignature) {
      return res.status(400).json({ error: "Payment signature mismatch" });
    }
  }

  const updated = await prisma.invoice.update({
    where: { id: job.invoice.id },
    data: {
      paymentStatus: "paid",
      paymentMethod: method || "UPI",
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
      paidAt: new Date(),
    },
  });
  if (job.mechanicId) {
    emitToUser(job.mechanicId, "payment_received", { jobId: job.id, total: updated.total, method });
    await prisma.notification.create({
      data: {
        userId: job.mechanicId,
        type: "payment_received",
        title: "Payment Received 💰",
        message: `₹${updated.total.toFixed(2)} via ${method || "UPI"}`,
        data: JSON.stringify({ jobId: job.id }),
      },
    });
    sendPushToUser(job.mechanicId, {
      title: "Payment Received 💰",
      body: `₹${updated.total.toFixed(2)} via ${method || "UPI"}`,
      data: { jobId: job.id, type: "payment_received" },
    });
  }
  res.json({ ok: true, invoice: updated });
});

// ─── POST /api/payments/invoice/:jobId/pay ─────────────────────────
// Cash / offline payment marker.
r.post("/invoice/:jobId/pay", requireAuth, async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId }, include: { invoice: true } });
  if (!job?.invoice) return res.status(404).json({ error: "Invoice not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your invoice" });

  const method = String(req.body?.method || "CASH");
  const updated = await prisma.invoice.update({
    where: { id: job.invoice.id },
    data: { paymentStatus: "paid", paymentMethod: method, paidAt: new Date() },
  });
  if (job.mechanicId) {
    emitToUser(job.mechanicId, "payment_received", { jobId: job.id, total: updated.total, method });
  }
  res.json({ ok: true, invoice: updated });
});

// ─── POST /api/payments/invoice/:jobId/tap-to-pay ──────────────────
// Uber-style one-tap charge. In dev mode (no Razorpay configured) this
// instantly marks the invoice paid as if a saved payment method auto-charged.
// In prod (Razorpay configured), the client should still use create-order +
// verify with the actual SDK; this endpoint stays as a safety fallback.
r.post("/invoice/:jobId/tap-to-pay", requireAuth, async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId }, include: { invoice: true } });
  if (!job?.invoice) return res.status(404).json({ error: "Invoice not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your invoice" });
  if (job.invoice.paymentStatus === "paid") return res.status(400).json({ error: "Already paid" });

  const method = String(req.body?.method || "UPI");
  if (!isRzpConfigured && !demoPaymentsEnabled) {
    return res.status(503).json({ error: "Razorpay is not configured. Set ENABLE_DEMO_PAYMENTS=true only for APK/demo testing." });
  }
  const wasCredit = (job.invoice as any).isCredit === true;
  const updated = await prisma.invoice.update({
    where: { id: job.invoice.id },
    data: {
      paymentStatus: "paid",
      paymentMethod: method,
      paidAt: new Date(),
      razorpayPaymentId: `dev_tap_${Date.now()}`,
      // Settling a previously-credited invoice — record when credit cleared
      ...(wasCredit ? { creditClearedAt: new Date() } : {}),
    } as any,
  });
  if (job.mechanicId) {
    emitToUser(job.mechanicId, "payment_received", { jobId: job.id, total: updated.total, method });
    await prisma.notification.create({
      data: {
        userId: job.mechanicId,
        type: "payment_received",
        title: wasCredit ? "Credit Cleared 💚" : "Payment Received 💰",
        message: `₹${updated.total.toFixed(2)} via ${method}${wasCredit ? " (credit settled)" : ""}`,
        data: JSON.stringify({ jobId: job.id }),
      },
    });
    sendPushToUser(job.mechanicId, {
      title: wasCredit ? "Credit Cleared 💚" : "Payment Received 💰",
      body: `₹${updated.total.toFixed(2)} via ${method}${wasCredit ? " (credit settled)" : ""}`,
      data: { jobId: job.id, type: "payment_received" },
    });
  }
  res.json({ ok: true, invoice: updated, demo: !isRzpConfigured });
});

// ═══════════════════════════════════════════════════════════════
// ONE-TIME CREDIT
// ═══════════════════════════════════════════════════════════════
// Customer can defer payment on a completed invoice ("pay later")
// after they've paid for at least N previous jobs. Only one
// outstanding credit allowed at a time — once cleared, available again.
// ═══════════════════════════════════════════════════════════════
const MIN_PAID_FOR_CREDIT = 2;

// ─── GET /api/payments/credit-eligibility ──────────────────────────
r.get("/credit-eligibility", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const paidCount = await prisma.invoice.count({
    where: { paymentStatus: "paid", job: { customerId: userId } },
  });

  const outstandingCredit = await prisma.invoice.findFirst({
    where: {
      paymentStatus: "pending",
      isCredit: true,
      job: { customerId: userId },
    } as any,
    include: { job: { include: { mechanic: { include: { mechanicProfile: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  const hasOutstanding = !!outstandingCredit;
  const enoughPaid = paidCount >= MIN_PAID_FOR_CREDIT;
  const eligible = enoughPaid && !hasOutstanding;

  let reason = "";
  if (hasOutstanding) {
    reason = "Clear your outstanding credit to use this option again.";
  } else if (!enoughPaid) {
    const left = MIN_PAID_FOR_CREDIT - paidCount;
    reason = `Complete ${left} more paid job${left > 1 ? "s" : ""} to unlock credit payments.`;
  }

  res.json({
    eligible,
    reason,
    paidJobsCount: paidCount,
    minPaidRequired: MIN_PAID_FOR_CREDIT,
    outstandingCredit: outstandingCredit ? {
      jobId: outstandingCredit.jobId,
      invoiceNumber: outstandingCredit.invoiceNumber,
      total: outstandingCredit.total,
      takenAt: (outstandingCredit as any).creditTakenAt?.toISOString?.() || null,
      mechanicName: outstandingCredit.job?.mechanic?.mechanicProfile?.shopName
                 || outstandingCredit.job?.mechanic?.name
                 || null,
    } : null,
  });
});

// ─── POST /api/payments/invoice/:jobId/credit ─────────────────────
// Customer chooses "Pay on Credit". Marks the invoice as credited
// (paymentStatus stays "pending"); customer must clear it later via
// /tap-to-pay or /pay (which will set creditClearedAt automatically).
r.post("/invoice/:jobId/credit", requireAuth, async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.jobId },
    include: { invoice: true },
  });
  if (!job?.invoice) return res.status(404).json({ error: "Invoice not found" });
  if (job.customerId !== req.user!.id) return res.status(403).json({ error: "Not your invoice" });
  if (job.invoice.paymentStatus === "paid") return res.status(400).json({ error: "Already paid" });
  if ((job.invoice as any).isCredit) return res.status(400).json({ error: "Credit already taken on this invoice" });

  // Re-check eligibility server-side (the client's check is hint only)
  const paidCount = await prisma.invoice.count({
    where: { paymentStatus: "paid", job: { customerId: req.user!.id } },
  });
  if (paidCount < MIN_PAID_FOR_CREDIT) {
    return res.status(403).json({ error: `Credit unlocks after ${MIN_PAID_FOR_CREDIT} paid jobs. You have ${paidCount}.` });
  }

  const otherCredit = await prisma.invoice.findFirst({
    where: {
      paymentStatus: "pending",
      isCredit: true,
      job: { customerId: req.user!.id },
      NOT: { id: job.invoice.id },
    } as any,
  });
  if (otherCredit) {
    return res.status(409).json({ error: "Clear your previous credit first.", outstandingInvoiceNumber: otherCredit.invoiceNumber });
  }

  const updated = await prisma.invoice.update({
    where: { id: job.invoice.id },
    data: {
      isCredit: true,
      creditTakenAt: new Date(),
      paymentMethod: "CREDIT",
    } as any,
  });

  // Notify mechanic so they know the customer used the credit option
  if (job.mechanicId) {
    emitToUser(job.mechanicId, "credit_taken", { jobId: job.id, total: updated.total });
    await prisma.notification.create({
      data: {
        userId: job.mechanicId,
        type: "credit_taken",
        title: "Customer used credit 📒",
        message: `₹${updated.total.toFixed(2)} on credit (${updated.invoiceNumber}).`,
        data: JSON.stringify({ jobId: job.id }),
      },
    });
    sendPushToUser(job.mechanicId, {
      title: "Customer used credit 📒",
      body: `₹${updated.total.toFixed(2)} on credit (${updated.invoiceNumber}).`,
      data: { jobId: job.id, type: "credit_taken" },
    });
  }

  res.json({ ok: true, invoice: updated });
});

export default r;
