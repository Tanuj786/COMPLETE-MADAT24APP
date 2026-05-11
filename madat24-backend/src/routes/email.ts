import { Router } from "express";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { prisma } from "../prisma";
import { hashPassword } from "../auth";
import { otpLimiter, validate } from "../middleware";
import { SendEmailOtpSchema, VerifyEmailOtpSchema, ResetPasswordSchema } from "../schemas";
import { env, isEmailConfigured } from "../env";
import { log } from "../logger";

const r = Router();

let transporter: nodemailer.Transporter | null = null;
if (isEmailConfigured) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST!,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASS! },
  });
}

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const OTP_TTL_MS = 10 * 60 * 1000;

async function sendOtpMail(to: string, otp: string) {
  if (!transporter) return false;
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Madat24/7 — Verification Code",
    text: `Your Madat24/7 verification code is ${otp}. It expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0A0A0A;padding:32px;color:#fff;border-radius:12px;max-width:480px;margin:auto">
        <h2 style="color:#F97316;margin:0 0 8px">MADAT<span style="color:#2563EB">24</span><span style="color:#F97316;font-size:20px">/7</span></h2>
        <p style="color:#888;margin:0 0 24px;font-size:14px">Rapid Roadside Rescue · 24 Hours · 7 Days</p>
        <p style="color:#ccc;font-size:14px;margin:0 0 8px">Your one-time verification code:</p>
        <div style="font-size:38px;letter-spacing:10px;font-weight:bold;color:#F97316;background:#1A1A1A;padding:18px;border-radius:10px;text-align:center;margin:8px 0 16px">${otp}</div>
        <p style="color:#888;font-size:12px;margin:0">This code expires in <b>10 minutes</b>. If you did not request this, you can safely ignore this email.</p>
      </div>`,
  });
  return true;
}

// POST /api/email/send-otp
r.post("/send-otp", otpLimiter, validate(SendEmailOtpSchema), async (req, res) => {
  try {
    const { email } = req.body;

    const code = generateOtp();
    await prisma.otp.create({
      data: {
        identifier: email,
        channel: "email",
        code,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    if (transporter) {
      try {
        await sendOtpMail(email, code);
        return res.json({ message: "OTP sent to email." });
      } catch (e: any) {
        log.warn("smtp failed, returning devOtp", { error: e.message });
      }
    }
    log.info("dev OTP issued", { email, code });
    return res.json({ message: "OTP generated (dev mode — no SMTP configured).", devOtp: code });
  } catch (e: any) {
    log.error("email/send-otp failed", { error: e.message });
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// POST /api/email/verify-otp
r.post("/verify-otp", validate(VerifyEmailOtpSchema), async (req, res) => {
  const { email, otp } = req.body;

  const found = await prisma.otp.findFirst({
    where: { identifier: email, channel: "email", code: otp, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!found) return res.status(400).json({ error: "Incorrect OTP. Please try again." });
  if (found.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "OTP has expired. Please request a new one." });

  await prisma.otp.update({ where: { id: found.id }, data: { consumed: true } });
  // Issue a short-lived reset token (just a signed random nonce stored in the otp row)
  const resetToken = crypto.randomBytes(24).toString("hex");
  await prisma.otp.create({
    data: {
      identifier: email,
      channel: "email_reset",
      code: resetToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });
  return res.json({ message: "Verified", resetToken, email });
});

// POST /api/email/reset-password
r.post("/reset-password", validate(ResetPasswordSchema), async (req, res) => {
  const { email, resetToken, newPassword } = req.body;
  const tok = await prisma.otp.findFirst({
    where: { identifier: email, channel: "email_reset", code: resetToken, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!tok || tok.expiresAt.getTime() < Date.now()) {
    return res.status(400).json({ error: "Reset token invalid or expired." });
  }

  const passwordHash = await hashPassword(newPassword);
  // Update all accounts with this email (customer/mechanic share email is not allowed but be defensive)
  await prisma.user.updateMany({ where: { email }, data: { passwordHash } });
  await prisma.otp.update({ where: { id: tok.id }, data: { consumed: true } });
  res.json({ message: "Password updated successfully." });
});

export default r;
