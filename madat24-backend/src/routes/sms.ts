import { Router } from "express";
import { prisma } from "../prisma";
import { otpLimiter, validate } from "../middleware";
import { SendPhoneOtpSchema, VerifyPhoneOtpSchema } from "../schemas";
import { env, isSmsConfigured } from "../env";
import { log } from "../logger";

const r = Router();

const TW_SID = env.TWILIO_ACCOUNT_SID;
const TW_TOKEN = env.TWILIO_AUTH_TOKEN;
const TW_PHONE = env.TWILIO_PHONE;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

async function sendSms(to: string, body: string) {
  if (!isSmsConfigured) return false;
  // Lazy-load to avoid a hard dep when SMS isn't configured.
  const params = new URLSearchParams();
  params.append("From", TW_PHONE!);
  params.append("To", to);
  params.append("Body", body);
  const auth = Buffer.from(`${TW_SID}:${TW_TOKEN}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TW_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Twilio error: ${t}`);
  }
  return true;
}

// POST /api/sms/send-otp
r.post("/send-otp", otpLimiter, validate(SendPhoneOtpSchema), async (req, res) => {
  const { phone } = req.body;

  const code = generateOtp();
  await prisma.otp.create({
    data: {
      identifier: phone,
      channel: "phone",
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  if (isSmsConfigured) {
    try {
      await sendSms(phone, `Your Madat24 verification code is ${code}. Valid for 10 minutes.`);
      return res.json({ message: "OTP sent via SMS.", phone });
    } catch (e: any) {
      log.warn("twilio failed, returning devOtp", { error: e.message });
    }
  }

  log.info("dev SMS OTP issued", { phone, code });
  return res.json({ message: "OTP generated (dev mode — no Twilio configured).", devOtp: code, phone });
});

// POST /api/sms/verify-otp
r.post("/verify-otp", validate(VerifyPhoneOtpSchema), async (req, res) => {
  const { phone, otp } = req.body;

  const found = await prisma.otp.findFirst({
    where: { identifier: phone, channel: "phone", code: otp, consumed: false },
    orderBy: { createdAt: "desc" },
  });
  if (!found) return res.status(400).json({ error: "Incorrect or expired OTP." });
  if (found.expiresAt.getTime() < Date.now()) return res.status(400).json({ error: "OTP has expired." });
  await prisma.otp.update({ where: { id: found.id }, data: { consumed: true } });
  res.json({ message: "Verified", verified: true });
});

export default r;
