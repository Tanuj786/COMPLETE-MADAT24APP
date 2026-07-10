import { Router } from "express";
import { prisma } from "../prisma";
import { signToken, hashPassword, comparePassword, requireAuth } from "../auth";
import { authLimiter, validate } from "../middleware";
import { SignupSchema, LoginSchema } from "../schemas";

const r = Router();

// POST /api/auth/signup
r.post("/signup", authLimiter, validate(SignupSchema), async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    const normEmail = email; // already normalized by zod

    const existing = await prisma.user.findFirst({
      where: { email: normEmail, role },
    });
    if (existing) {
      return res.status(409).json({ error: `An account already exists for ${normEmail} as ${role.toLowerCase()}.` });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normEmail,
        phone: String(phone).trim(),
        passwordHash,
        role,
        emailVerified: false,
        phoneVerified: false,
      },
    });
    // Auto-create empty mechanic profile so /mechanic/profile works immediately
    if (role === "MECHANIC") {
      await prisma.mechanicProfile.create({
        data: { userId: user.id, shopName: `${user.name}'s Shop` },
      });
    }
    const token = signToken({ id: user.id, email: user.email, role: role as "CUSTOMER" | "MECHANIC" });
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, emailVerified: false },
    });
  } catch (e: any) {
    console.error("[auth/signup]", e);
    return res.status(500).json({ error: "Signup failed" });
  }
});

// POST /api/auth/login
r.post("/login", authLimiter, validate(LoginSchema), async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normEmail = email; // already normalized by zod
    const user = await prisma.user.findFirst({ where: { email: normEmail, role } });
    if (!user) return res.status(404).json({ error: `No ${String(role).toLowerCase()} account found for ${normEmail}.` });
    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Incorrect password. Please try again." });
    const token = signToken({ id: user.id, email: user.email, role: user.role as "CUSTOMER" | "MECHANIC" });
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (e: any) {
    console.error("[auth/login]", e);
    return res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
r.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
  });
});

// PATCH /api/auth/fcm-token
r.patch("/fcm-token", requireAuth, async (req, res) => {
  const { fcmToken } = req.body || {};
  await prisma.user.update({ where: { id: req.user!.id }, data: { fcmToken } });
  res.json({ ok: true });
});

export default r;
