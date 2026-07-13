import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiLogin, apiSignup, clearToken } from "~/lib/api";
import { registerPushOnLogin, clearPushRegistration } from "~/lib/push";
import type {
  CustomerJob, ServiceRequest, ShopProfile, MechanicMetrics,
  AppNotification, Invoice, ChatMessage, MediaItem, Review,
} from "~/types";

// ─── helpers ──────────────────────────────────────────────────────
const uid = () => `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ─── AUTH ──────────────────────────────────────────────────────────
export interface AuthUser {
  id: string; name: string; phone: string; email?: string;
  role: "customer" | "mechanic";
}

interface AuthStore {
  user: AuthUser | null;
  isLoggedIn: boolean;
  login: (email: string, password: string, role: AuthUser["role"]) => Promise<void>;
  signup: (data: { name: string; email: string; phone: string; password: string }, role: AuthUser["role"]) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (p: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoggedIn: false,

  login: async (email, password, role) => {
    const { user } = await apiLogin({
      email: email.trim().toLowerCase(),
      password,
      role: role.toUpperCase() as "CUSTOMER" | "MECHANIC",
    });
    const authUser: AuthUser = {
      id:    user.id,
      name:  user.name,
      phone: user.phone,
      email: user.email,
      role:  user.role.toLowerCase() as "customer" | "mechanic",
    };
    // Persist session so it survives app restart
    await AsyncStorage.setItem("madat24_user", JSON.stringify(authUser));
    set({ user: authUser, isLoggedIn: true });
    // Best-effort push registration — never blocks login
    registerPushOnLogin().catch(() => {});
  },

  signup: async (data, role) => {
    const { user } = await apiSignup({
      name:     data.name.trim(),
      email:    data.email.trim().toLowerCase(),
      phone:    data.phone.trim(),
      password: data.password,
      role:     role.toUpperCase() as "CUSTOMER" | "MECHANIC",
    });
    const authUser: AuthUser = {
      id:    user.id,
      name:  user.name,
      phone: user.phone,
      email: user.email,
      role:  user.role.toLowerCase() as "customer" | "mechanic",
    };
    await AsyncStorage.setItem("madat24_user", JSON.stringify(authUser));
    set({ user: authUser, isLoggedIn: true });
    registerPushOnLogin().catch(() => {});
  },

  logout: async () => {
    await clearToken();
    await AsyncStorage.removeItem("madat24_user");
    clearPushRegistration();
    set({ user: null, isLoggedIn: false });
  },
  updateProfile: (p) => set(s => ({ user: s.user ? { ...s.user, ...p } : null })),
}));

// ─── CUSTOMER ──────────────────────────────────────────────────────
interface CustomerStore {
  jobs: CustomerJob[];            // ← CLEAN: starts EMPTY
  addJob: (j: CustomerJob) => void;
  updateJobStatus: (id: string, status: CustomerJob["status"]) => void;
  updateJobMechanic: (id: string, mechanic: NonNullable<CustomerJob["mechanic"]>) => void;
  updateJobInvoice: (id: string, invoice: Invoice) => void;
  addCustomerMedia: (jobId: string, media: MediaItem) => void;
  updateProgressMedia: (jobId: string, media: MediaItem[]) => void;
  cancelJob: (id: string) => void;
  payInvoice: (jobId: string, method: string) => void;
  addReview: (jobId: string, rating: number, review: string, tags: string[]) => void;
}
export const useCustomerStore = create<CustomerStore>(set => ({
  jobs: [],  // ← ZERO on fresh account
  addJob: (j) => set(s => ({ jobs: [j, ...s.jobs] })),
  updateJobStatus: (id, status) =>
    set(s => ({
      jobs: s.jobs.map(j => {
        if (j.id !== id) return j;
        const ts = { ...j.timestamps };
        if (status === "accepted")    ts.accepted  = new Date().toISOString();
        if (status === "in-progress") ts.started   = new Date().toISOString();
        if (status === "completed")   ts.completed = new Date().toISOString();
        if (status === "cancelled")   ts.cancelled = new Date().toISOString();
        return { ...j, status, timestamps: ts };
      }),
    })),
  updateJobMechanic: (id, mechanic) =>
    set(s => ({ jobs: s.jobs.map(j => j.id !== id ? j : { ...j, mechanic }) })),
  updateJobInvoice: (id, invoice) =>
    set(s => ({ jobs: s.jobs.map(j => j.id !== id ? j : { ...j, invoice }) })),
  addCustomerMedia: (jobId, media) =>
    set(s => ({ jobs: s.jobs.map(j => j.id !== jobId ? j : { ...j, customerMedia: [...j.customerMedia, media] }) })),
  updateProgressMedia: (jobId, media) =>
    set(s => ({ jobs: s.jobs.map(j => j.id !== jobId ? j : { ...j, progressMedia: media }) })),
  cancelJob: (id) =>
    set(s => ({
      jobs: s.jobs.map(j =>
        j.id !== id ? j : { ...j, status: "cancelled" as const, timestamps: { ...j.timestamps, cancelled: new Date().toISOString() } }
      ),
    })),
  payInvoice: (jobId, method) =>
    set(s => ({
      jobs: s.jobs.map(j =>
        j.id !== jobId || !j.invoice ? j : { ...j, invoice: { ...j.invoice, paymentStatus: "paid" as const, paymentMethod: method } }
      ),
    })),
  addReview: (jobId, rating, review, tags) =>
    set(s => ({
      jobs: s.jobs.map(j => j.id !== jobId ? j : { ...j, rating, review }),
    })),
}));

// ─── MECHANIC ──────────────────────────────────────────────────────
export type ActiveJob = {
  id: string; serviceType: string; status: "accepted" | "in-progress";
  location?: { address: string; city: string };
  customer?: { id: string; name: string; phone: string };
  vehicleInfo?: { type: string; make?: string; model?: string };
  description?: string;
  timestamps?: { requested?: string; accepted?: string; started?: string };
  customerMedia: MediaItem[];
  progressMedia: MediaItem[];
  completionMedia: MediaItem[];
  invoice?: Invoice;
};

interface MechanicStore {
  isOnline: boolean;
  toggleOnline: () => void;
  requests: ServiceRequest[];   // ← CLEAN: starts EMPTY (populated when customer sends request)
  activeJobs: ActiveJob[];      // ← ZERO until mechanic accepts
  completedJobs: ActiveJob[];   // ← ZERO until jobs completed
  reviews: Review[];            // ← ZERO until customers review
  metrics: MechanicMetrics;     // ← all zeros
  shopProfile: ShopProfile | null;
  // Actions
  setShopProfile: (sp: ShopProfile) => void;
  updateShopProfile: (p: Partial<ShopProfile>) => void;
  setMetrics: (m: MechanicMetrics) => void;
  addIncomingRequest: (req: ServiceRequest) => void;   // called when customer sends request
  removeRequest: (id: string) => void;                 // remove after another mechanic accepts
  acceptRequest: (id: string) => void;
  rejectRequest: (id: string) => void;
  startJob: (id: string) => void;
  completeJob: (id: string, amount: number, invoice: Invoice) => void;
  addProgressMedia: (jobId: string, media: MediaItem) => void;
  addCompletionMedia: (jobId: string, media: MediaItem) => void;
  addReview: (review: Review) => void;
}

export const useMechanicStore = create<MechanicStore>((set, get) => ({
  isOnline: false,
  toggleOnline: () => set(s => ({ isOnline: !s.isOnline })),
  requests: [],         // ZERO
  activeJobs: [],       // ZERO
  completedJobs: [],    // ZERO
  reviews: [],          // ZERO
  shopProfile: null,
  metrics: {
    totalEarnings: 0, jobsCompleted: 0, averageRating: 0, reviewCount: 0,
    responseRate: 0, completionRate: 0, customerSatisfaction: 0,
    earningsThisMonth: 0, earningsThisWeek: 0, jobsThisMonth: 0, jobsThisWeek: 0,
  },

  setShopProfile: (sp) => set({ shopProfile: sp }),
  updateShopProfile: (p) => set(s => ({ shopProfile: s.shopProfile ? { ...s.shopProfile, ...p } : null })),
  setMetrics: (m) => set({ metrics: m }),

  // Called by request screen when customer confirms
  addIncomingRequest: (req) =>
    set(s => s.requests.some(r => r.id === req.id) ? s : { requests: [req, ...s.requests] }),

  // Remove a specific request by ID (used when another mechanic accepts it first)
  removeRequest: (id) =>
    set(s => ({ requests: s.requests.filter(r => r.id !== id) })),

  // Accept → syncs customer store + sends notification
  acceptRequest: (id) =>
    set(s => {
      const req = s.requests.find(r => r.id === id);
      if (!req) return s;
      const sp = s.shopProfile;
      const job: ActiveJob = {
        id: req.id, serviceType: req.serviceType, status: "accepted",
        location: { address: req.location.address, city: req.location.city },
        customer: { id: req.customerId, name: req.customerName, phone: req.customerPhone },
        vehicleInfo: req.vehicleInfo, description: req.description,
        timestamps: { requested: req.createdAt, accepted: new Date().toISOString() },
        customerMedia: req.media || [], progressMedia: [], completionMedia: [],
      };
      // Sync customer store
      const cst = useCustomerStore.getState();
      cst.updateJobStatus(id, "accepted");
      cst.updateJobMechanic(id, {
        id: sp?.mechanicId || "mech",
        name: sp?.shopName || "Your Mechanic",
        shopName: sp?.shopName || "Mechanic Shop",
        phone: sp?.whatsappNumber || req.customerPhone,
        rating: sp?.rating || 0,
      });
      // Notify customer
      useNotifStore.getState().addNotification({
        id: `notif-${uid()}`, userId: req.customerId, type: "job_accepted",
        title: "Request Accepted! ✅",
        message: `${sp?.shopName || "A mechanic"} accepted your ${req.serviceType.replace(/-/g, " ")} request. On the way!`,
        read: false, createdAt: new Date().toISOString(),
      });
      return {
        requests: s.requests.filter(r => r.id !== id),
        activeJobs: [...s.activeJobs, job],
      };
    }),

  rejectRequest: (id) =>
    set(s => ({ requests: s.requests.filter(r => r.id !== id) })),

  startJob: (id) => {
    set(s => ({
      activeJobs: s.activeJobs.map(j =>
        j.id !== id ? j : {
          ...j, status: "in-progress" as const,
          timestamps: { ...j.timestamps, started: new Date().toISOString() },
        }
      ),
    }));
    useCustomerStore.getState().updateJobStatus(id, "in-progress");
    const job = get().activeJobs.find(j => j.id === id);
    if (job?.customer) {
      useNotifStore.getState().addNotification({
        id: `notif-${uid()}`, userId: job.customer.id, type: "job_started",
        title: "Mechanic Started Work 🔧",
        message: "Your mechanic has arrived and is working on your vehicle",
        read: false, createdAt: new Date().toISOString(),
      });
    }
  },

  addProgressMedia: (jobId, media) => {
    set(s => ({
      activeJobs: s.activeJobs.map(j =>
        j.id !== jobId ? j : { ...j, progressMedia: [...j.progressMedia, media] }
      ),
    }));
    const updated = get().activeJobs.find(j => j.id === jobId);
    if (updated) useCustomerStore.getState().updateProgressMedia(jobId, updated.progressMedia);
  },

  addCompletionMedia: (jobId, media) =>
    set(s => ({
      activeJobs: s.activeJobs.map(j =>
        j.id !== jobId ? j : { ...j, completionMedia: [...j.completionMedia, media] }
      ),
    })),

  completeJob: (id, amount, invoice) =>
    set(s => {
      const job = s.activeJobs.find(j => j.id === id);
      if (!job) return s;
      useCustomerStore.getState().updateJobStatus(id, "completed");
      useCustomerStore.getState().updateJobInvoice(id, invoice);
      if (job.customer) {
        useNotifStore.getState().addNotification({
          id: `notif-${uid()}`, userId: job.customer.id, type: "job_completed",
          title: "Service Completed! ✅",
          message: `Your vehicle is ready. Invoice ${invoice.invoiceNumber}: ₹${invoice.total.toFixed(2)}`,
          read: false, createdAt: new Date().toISOString(),
        });
        useNotifStore.getState().addNotification({
          id: `notif-${uid()}`, userId: job.customer.id, type: "payment_requested",
          title: "Payment Requested 💳",
          message: `Please pay ₹${invoice.total.toFixed(2)} to complete the service`,
          read: false, createdAt: new Date().toISOString(),
        });
      }
      return {
        activeJobs: s.activeJobs.filter(j => j.id !== id),
        completedJobs: [{ ...job, invoice }, ...s.completedJobs],
        metrics: {
          ...s.metrics,
          jobsCompleted: s.metrics.jobsCompleted + 1,
          totalEarnings: s.metrics.totalEarnings + amount,
          earningsThisWeek: s.metrics.earningsThisWeek + amount,
          earningsThisMonth: s.metrics.earningsThisMonth + amount,
          jobsThisWeek: s.metrics.jobsThisWeek + 1,
          jobsThisMonth: s.metrics.jobsThisMonth + 1,
        },
      };
    }),

  // Only after customer submits review post-payment
  addReview: (review) =>
    set(s => {
      const total = s.reviews.length + 1;
      const newAvg = (s.metrics.averageRating * s.reviews.length + review.rating) / total;
      return {
        reviews: [review, ...s.reviews],
        metrics: {
          ...s.metrics,
          reviewCount: total,
          averageRating: Math.round(newAvg * 10) / 10,
          customerSatisfaction: Math.round((newAvg / 5) * 100),
        },
      };
    }),
}));

// ─── NOTIFICATIONS ─────────────────────────────────────────────────
interface NotifStore {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
}
export const useNotifStore = create<NotifStore>(set => ({
  notifications: [],  // ← ZERO
  unreadCount: 0,
  addNotification: (n) =>
    set(s => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + (n.read ? 0 : 1),
    })),
  markRead: (id) =>
    set(s => ({
      notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set(s => ({ notifications: s.notifications.map(n => ({ ...n, read: true })), unreadCount: 0 })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// ─── CHAT ──────────────────────────────────────────────────────────
interface ChatStore {
  messages: Record<string, ChatMessage[]>;
  sendMessage: (jobId: string, msg: ChatMessage) => void;
  setMessages: (jobId: string, msgs: ChatMessage[]) => void;
}
export const useChatStore = create<ChatStore>(set => ({
  messages: {},   // ← ZERO
  sendMessage: (jobId, msg) =>
    set(s => ({ messages: { ...s.messages, [jobId]: [...(s.messages[jobId] || []), msg] } })),
  setMessages: (jobId, msgs) =>
    set(s => ({ messages: { ...s.messages, [jobId]: msgs } })),
}));

// ─── NEARBY / BROADCAST ────────────────────────────────────────────
// Tracks all registered mechanic locations and handles 10km broadcast logic.

export interface MechanicRegistration {
  mechanicId: string;
  name: string;
  lat: number;
  lng: number;
  isOnline: boolean;
}

// Haversine distance in kilometres
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface NearbyStore {
  mechanics: Record<string, MechanicRegistration>;
  acceptedJobs: string[]; // flat array for Zustand serialisation
  registerMechanic: (reg: MechanicRegistration) => void;
  updateMechanicOnline: (id: string, isOnline: boolean) => void;
  updateMechanicLocation: (id: string, lat: number, lng: number) => void;
  broadcastRequest: (req: ServiceRequest, radiusKm?: number) => string[];
  markJobAccepted: (jobId: string) => boolean;
}

export const useNearbyStore = create<NearbyStore>((set, get) => ({
  mechanics: {},
  acceptedJobs: [],

  registerMechanic: (reg) =>
    set(s => ({ mechanics: { ...s.mechanics, [reg.mechanicId]: reg } })),

  updateMechanicOnline: (id, isOnline) =>
    set(s => ({
      mechanics: s.mechanics[id]
        ? { ...s.mechanics, [id]: { ...s.mechanics[id], isOnline } }
        : s.mechanics,
    })),

  updateMechanicLocation: (id, lat, lng) =>
    set(s => ({
      mechanics: s.mechanics[id]
        ? { ...s.mechanics, [id]: { ...s.mechanics[id], lat, lng } }
        : s.mechanics,
    })),

  broadcastRequest: (req, radiusKm = 10) => {
    const { mechanics } = get();
    const { lat: cLat, lng: cLng } = req.location.coordinates;
    const matched: string[] = [];
    for (const m of Object.values(mechanics)) {
      if (!m.isOnline) continue;
      const dist = haversineKm(cLat, cLng, m.lat, m.lng);
      if (dist <= radiusKm) matched.push(m.mechanicId);
    }
    return matched;
  },

  markJobAccepted: (jobId) => {
    const { acceptedJobs } = get();
    if (acceptedJobs.includes(jobId)) return false;
    set(s => ({ acceptedJobs: [...s.acceptedJobs, jobId] }));
    return true;
  },
}));
