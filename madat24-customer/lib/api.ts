/**
 * MADAT24 API CLIENT
 * ─────────────────────────────────────────────────────────
 * - BASE_URL comes from app.config.js → expoConfig.extra.API_URL
 *   (set per EAS build profile in eas.json)
 * - In dev, override via .env: API_URL=http://YOUR_PC_IP:4000/api
 * - Auth always goes to the backend. There is NO offline-mode
 *   password storage anymore — that was a security risk.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? Constants.manifest?.extra) as { API_URL?: string } | undefined;
export const BASE_URL: string = extra?.API_URL || "https://complete-madat24app-1.onrender.com/api";

// ─── Token helpers ────────────────────────────────────────────────
export const saveToken  = (t: string) => AsyncStorage.setItem("madat24_token", t);
export const clearToken = ()          => AsyncStorage.removeItem("madat24_token");
export const getToken   = ()          => AsyncStorage.getItem("madat24_token");

// ─── Backend availability (non-blocking, cached) ──────────────────
let _backendOk   = false;
let _checkedAt   = 0;
let _backendCheck: Promise<boolean> | null = null;

/** Check backend health, caching briefly so auth does not fail on stale startup state. */
function checkBackend(): Promise<boolean> {
  const now = Date.now();
  if (now - _checkedAt < 20000 && _backendOk) return Promise.resolve(true);
  if (_backendCheck) return _backendCheck;
  _checkedAt = now;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  _backendCheck = fetch(BASE_URL.replace("/api", "") + "/health", { signal: controller.signal })
    .then(r => (_backendOk = r.ok))
    .catch(() => (_backendOk = false))
    .finally(() => {
      clearTimeout(t);
      _backendCheck = null;
    });
  return _backendCheck;
}

// ─── Raw HTTP call (only used when _backendOk is true) ───────────
async function callBackend<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = true,
  retries = 0,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if (requireAuth) {
    const token = await getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutMs = path.startsWith("/auth/") ? 60000 : 25000;
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal });
    } catch (err: any) {
      clearTimeout(tid);
      if (attempt < retries && (err?.name === "AbortError" || err instanceof TypeError)) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (err?.name === "AbortError" || err instanceof TypeError) {
        throw new Error(NO_BACKEND_MSG);
      }
      throw err;
    }
    clearTimeout(tid);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (attempt < retries && res.status >= 500) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
    }
    return data as T;
  }
  throw new Error(NO_BACKEND_MSG);
}

// ═══════════════════════════════════════════════════════════
// (Removed) — old local-account helpers stored passwords in
// AsyncStorage in plain text. They are gone for security.
// All auth now requires the backend.
// ═══════════════════════════════════════════════════════════
const NO_BACKEND_MSG = "Cannot reach the server. Please check your internet connection and try again.";
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// ═══════════════════════════════════════════════════════════
// PUBLIC API TYPES
// ═══════════════════════════════════════════════════════════
export interface ApiUser {
  id: string; name: string; email: string; phone: string; role: string;
}

// ═══════════════════════════════════════════════════════════
// SIGNUP — backend-only (no plain-text password on device)
// ═══════════════════════════════════════════════════════════
export async function apiSignup(data: {
  name: string; email: string; phone: string;
  password: string; role: "CUSTOMER" | "MECHANIC";
}): Promise<{ token: string; user: ApiUser }> {
  const r = await callBackend<{ token: string; user: ApiUser }>(
    "/auth/signup",
    { method: "POST", body: JSON.stringify({ ...data, email: data.email.toLowerCase().trim() }) },
    false,
  );
  await saveToken(r.token);
  return r;
}

// ═══════════════════════════════════════════════════════════
// LOGIN — backend-only
// ═══════════════════════════════════════════════════════════
export async function apiLogin(data: {
  email: string; password: string; role: "CUSTOMER" | "MECHANIC";
}): Promise<{ token: string; user: ApiUser }> {
  const r = await callBackend<{ token: string; user: ApiUser }>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ ...data, email: data.email.toLowerCase().trim() }) },
    false,
    2,
  );
  await saveToken(r.token);
  return r;
}

export const apiGetMe        = () => callBackend<{ user: ApiUser }>("/auth/me");
export const apiSaveFcmToken = (t: string) =>
  callBackend("/auth/fcm-token", { method: "PATCH", body: JSON.stringify({ fcmToken: t }) });

// ═══════════════════════════════════════════════════════════
// EMAIL OTP  (Forgot Password)
// ═══════════════════════════════════════════════════════════
export async function apiSendOtp(email: string): Promise<{ message: string; devOtp?: string }> {
  if (!(await checkBackend())) throw new Error(NO_BACKEND_MSG);
  return await callBackend<{ message: string; devOtp?: string }>(
    "/email/send-otp",
    { method: "POST", body: JSON.stringify({ email: email.toLowerCase().trim() }) },
    false,
  );
}

export async function apiVerifyOtp(
  email: string, otp: string,
): Promise<{ message: string; resetToken: string; email: string }> {
  if (!(await checkBackend())) throw new Error(NO_BACKEND_MSG);
  return await callBackend<{ message: string; resetToken: string; email: string }>(
    "/email/verify-otp",
    { method: "POST", body: JSON.stringify({ email: email.toLowerCase().trim(), otp }) },
    false,
  );
}

export async function apiResetPassword(
  email: string, resetToken: string, newPassword: string,
): Promise<{ message: string }> {
  if (!(await checkBackend())) throw new Error(NO_BACKEND_MSG);
  return await callBackend<{ message: string }>(
    "/email/reset-password",
    { method: "POST", body: JSON.stringify({ email: email.toLowerCase().trim(), resetToken, newPassword }) },
    false,
  );
}

// ═══════════════════════════════════════════════════════════
// SMS OTP  (Mechanic phone verification)
// ═══════════════════════════════════════════════════════════
function formatPhone(phone: string): string {
  const c = phone.replace(/\s/g, "");
  return c.startsWith("+") ? c : "+91" + c.replace(/^0/, "");
}

export async function apiSendPhoneOtp(
  phone: string,
): Promise<{ message: string; devOtp?: string; phone?: string }> {
  if (!(await checkBackend())) throw new Error(NO_BACKEND_MSG);
  return await callBackend<{ message: string; devOtp?: string; phone?: string }>(
    "/sms/send-otp", { method: "POST", body: JSON.stringify({ phone: formatPhone(phone) }) }, false,
  );
}

export async function apiVerifyPhoneOtp(
  phone: string, otp: string,
): Promise<{ message: string; verified: boolean }> {
  if (!(await checkBackend())) throw new Error(NO_BACKEND_MSG);
  return await callBackend<{ message: string; verified: boolean }>(
    "/sms/verify-otp", { method: "POST", body: JSON.stringify({ phone: formatPhone(phone), otp }) }, false,
  );
}

// ═══════════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════════
export interface CreateJobInput {
  serviceType: string; vehicleType: string; vehicleMake?: string;
  vehicleModel?: string; address: string; city: string;
  latitude: number; longitude: number; description?: string;
  estimatedMin?: number; estimatedMax?: number;
}
export const apiCreateJob = (d: CreateJobInput) =>
  callBackend<{ job: any; mechanicsAlerted: number }>("/jobs", { method: "POST", body: JSON.stringify(d) });

// ─── Real registered mechanics within 10km (only online ones) ──────
export interface NearbyMechanic {
  id:           string;
  name:         string;
  phone:        string;
  shopName:     string;
  rating:       number;
  totalRatings: number;
  isVerified:   boolean;
  profilePhoto: string | null;
  vehicleTypes: string[];
  services:     string[];
  dist:         number;   // km from customer
  eta:          string;   // e.g. "8 min"
  latitude:     number;
  longitude:    number;
}

// Fetch only real registered mechanics who are online and within 10km.
// Returns empty array if none — no mock/fallback data.
export const apiGetNearbyMechanics = (lat: number, lng: number) =>
  callBackend<{ mechanics: NearbyMechanic[]; total: number }>(
    `/jobs/nearby-mechanics?latitude=${lat}&longitude=${lng}`
  );
export const apiGetMyJobs = () => callBackend<{ jobs: any[] }>("/jobs");
export const apiGetJob    = (id: string) => callBackend<{ job: any }>(`/jobs/${id}`);
export const apiCancelJob = (id: string) => callBackend(`/jobs/${id}/cancel`, { method: "PATCH" });
export const apiUpdateJobLocation = (id: string, lat: number, lng: number) =>
  callBackend(`/jobs/${id}/location`, { method: "PATCH", body: JSON.stringify({ latitude: lat, longitude: lng }) });
export const apiTapToPay = (jobId: string, method = "UPI") =>
  callBackend(`/payments/invoice/${jobId}/tap-to-pay`, { method: "POST", body: JSON.stringify({ method }) });

// ═══════════════════════════════════════════════════════════
// MECHANIC
// ═══════════════════════════════════════════════════════════
export const apiAcceptRequest  = (jobId: string) => callBackend(`/mechanic/requests/${jobId}/accept`, { method: "POST" });
export const apiRejectRequest  = (jobId: string) => callBackend(`/mechanic/requests/${jobId}/reject`, { method: "POST" });
export const apiArriveJob      = (jobId: string) => callBackend(`/mechanic/jobs/${jobId}/arrive`, { method: "PATCH" });
export const apiStartJob       = (jobId: string) => callBackend(`/mechanic/jobs/${jobId}/start`, { method: "PATCH" });
export const apiCompleteJob    = (jobId: string, items: any[], notes = "") =>
  callBackend(`/mechanic/jobs/${jobId}/complete`, { method: "PATCH", body: JSON.stringify({ lineItems: items, notes }) });
export const apiGetMechJobs    = () => callBackend<{ jobs: any[] }>("/mechanic/jobs");
export const apiUpdateLocation = (lat: number, lng: number, online: boolean) =>
  callBackend("/mechanic/location", { method: "PATCH", body: JSON.stringify({ latitude: lat, longitude: lng, isOnline: online }) });
export const apiToggleOnline   = (online: boolean) =>
  callBackend("/mechanic/online", { method: "PATCH", body: JSON.stringify({ isOnline: online }) });
export const apiGetMechProfile  = () => callBackend<{ profile: any; metrics: any }>("/mechanic/profile");
export const apiSaveMechProfile = (d: any) => callBackend("/mechanic/profile", { method: "PUT", body: JSON.stringify(d) });

// ═══════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════
export const apiGetInvoice    = (jobId: string) => callBackend<{ invoice: any }>(`/payments/invoice/${jobId}`);
export const apiCreateOrder   = (jobId: string) =>
  callBackend<{ orderId: string; amount: number; currency: string; keyId: string; isDemoMode?: boolean }>(
    "/payments/create-order", { method: "POST", body: JSON.stringify({ jobId }) },
  );
export const apiVerifyPayment = (
  jobId: string, razorpayOrderId: string, razorpayPaymentId: string,
  razorpaySignature: string, method = "UPI",
) => callBackend("/payments/verify", {
  method: "POST",
  body: JSON.stringify({ jobId, razorpayOrderId, razorpayPaymentId, razorpaySignature, method }),
});
export const apiPayCash = (jobId: string, method = "CASH") =>
  callBackend(`/payments/invoice/${jobId}/pay`, { method: "POST", body: JSON.stringify({ method }) });

// ═══════════════════════════════════════════════════════════
// CHAT
// ═══════════════════════════════════════════════════════════
export const apiGetMessages = (jobId: string) => callBackend<{ messages: any[] }>(`/chat/${jobId}`);
export const apiSendMessage = (jobId: string, text: string) =>
  callBackend<{ message: any }>(`/chat/${jobId}`, { method: "POST", body: JSON.stringify({ text }) });

export async function apiSendChatImage(jobId: string, imageUri: string) {
  const form = new FormData();
  form.append("image", { uri: imageUri, type: "image/jpeg", name: "chat.jpg" } as any);
  const token = await getToken();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(`${BASE_URL}/chat/${jobId}/image`, {
    method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, body: form, signal: controller.signal,
  }).finally(() => clearTimeout(tid));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// ═══════════════════════════════════════════════════════════
// MEDIA
// ═══════════════════════════════════════════════════════════
export async function apiUploadMedia(
  jobId: string, fileUri: string,
  category: "customer" | "progress" | "completion" | "review", mimeType = "image/jpeg",
) {
  const form = new FormData();
  form.append("file", { uri: fileUri, type: mimeType, name: "media.jpg" } as any);
  form.append("category", category);
  const token = await getToken();
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  const res = await fetch(`${BASE_URL}/media/${jobId}`, {
    method: "POST", headers: { Authorization: `Bearer ${token ?? ""}` }, body: form, signal: controller.signal,
  }).finally(() => clearTimeout(tid));
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// ═══════════════════════════════════════════════════════════
// REVIEWS + NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
export const apiSubmitReview   = (jobId: string, d: { rating: number; review: string; tags?: string[] }) =>
  callBackend(`/reviews/${jobId}`, { method: "POST", body: JSON.stringify(d) });
export const apiGetMechReviews = (mechanicId: string) => callBackend<{ reviews: any[] }>(`/reviews/mechanic/${mechanicId}`);
export const apiGetNotifs      = () => callBackend<{ notifications: any[] }>("/notifications");
export const apiMarkRead       = (id: string) => callBackend(`/notifications/${id}/read`, { method: "PATCH" });
export const apiMarkAllRead    = () => callBackend("/notifications/read-all", { method: "PATCH" });
export const apiClearNotifs    = () => callBackend("/notifications", { method: "DELETE" });

// ═══════════════════════════════════════════════════════════
// CREDIT (one-time pay-later)
// ═══════════════════════════════════════════════════════════
export interface CreditEligibility {
  eligible: boolean;
  reason: string;
  paidJobsCount: number;
  minPaidRequired: number;
  outstandingCredit: {
    jobId: string;
    invoiceNumber: string;
    total: number;
    takenAt: string | null;
    mechanicName: string | null;
  } | null;
}
export const apiCreditEligibility = () =>
  callBackend<CreditEligibility>("/payments/credit-eligibility");
export const apiUseCredit = (jobId: string) =>
  callBackend<{ ok: true; invoice: any }>(`/payments/invoice/${jobId}/credit`, { method: "POST" });

// ═══════════════════════════════════════════════════════════
// AI ASSISTANT
// ═══════════════════════════════════════════════════════════
export type AiSeverity = "low" | "medium" | "high";
export type AiSuggestedService =
  | "tyre-puncture" | "fuel-delivery" | "engine-repair" | "brake-repair"
  | "battery-jump-start" | "towing-services" | "oil-change" | "ac-repair" | null;

export interface AiStructured {
  summary: string;
  severity: AiSeverity;
  steps: string[];
  needsMechanic: boolean;
  suggestedService: AiSuggestedService;
  estimatedCostINR: { min: number; max: number } | null;
  warning: string;
}

export interface AiChatResponse {
  message: string;
  structured: AiStructured | null;
}

export const apiAiStatus = () =>
  callBackend<{ configured: boolean; model: string }>("/ai/status", { method: "GET" }, false);

export const apiAiChat = (messages: { role: "user" | "assistant"; content: string }[]) =>
  callBackend<AiChatResponse>("/ai/chat", { method: "POST", body: JSON.stringify({ messages }) });
