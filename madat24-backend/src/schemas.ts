import { z } from "zod";

const role = z.enum(["CUSTOMER", "MECHANIC"]);

export const SignupSchema = z.object({
  name: z.string().min(2).max(60).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().min(7).max(20).trim(),
  password: z.string().min(6).max(100),
  role,
});

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
  role,
});

export const SendEmailOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export const VerifyEmailOtpSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const ResetPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  resetToken: z.string().min(1),
  newPassword: z.string().min(6).max(100),
});

export const SendPhoneOtpSchema = z.object({
  phone: z.string().regex(/^\+\d{6,15}$/, "Phone must be E.164 like +919999999999"),
});

export const VerifyPhoneOtpSchema = z.object({
  phone: z.string().regex(/^\+\d{6,15}$/, "Invalid phone"),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const CreateJobSchema = z.object({
  serviceType: z.string().min(1),
  vehicleType: z.string().optional().default("car"),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleYear: z.string().optional(),
  licensePlate: z.string().optional(),
  address: z.string().min(1),
  city: z.string().optional().default(""),
  state: z.string().optional(),
  pincode: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().optional(),
  estimatedMin: z.number().nonnegative().optional(),
  estimatedMax: z.number().nonnegative().optional(),
});

export const UpdateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const UpdateMechanicLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  isOnline: z.boolean().optional(),
});

export const InvoiceLineItemsSchema = z.object({
  lineItems: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative(),
        total: z.number().nonnegative().optional(),
      }),
    )
    .min(1, "Add at least one line item"),
});
