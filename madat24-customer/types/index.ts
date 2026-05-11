export type ServiceType =
  | "tyre-puncture" | "fuel-delivery" | "engine-repair" | "brake-repair"
  | "battery-jump-start" | "towing-services" | "oil-change" | "ac-repair";

export type VehicleType = "car"|"bike"|"electric"|"battery"|"tyre"|"general";

export type JobStatus = "pending"|"accepted"|"in-progress"|"completed"|"cancelled";

export interface Location {
  address: string; city: string; state: string; pincode: string;
  coordinates: { lat: number; lng: number };
}

export interface MediaItem {
  id: string; type: "photo"|"video"; uri: string;
  uploadedAt: string; uploadedBy: string;
}

export interface VehicleInfo {
  type: VehicleType; make?: string; model?: string; year?: string; licensePlate?: string;
}

export interface InvoiceLineItem { id: string; description: string; quantity: number; unitPrice: number; total: number; }

export interface Invoice {
  id: string; jobId: string; invoiceNumber: string; date: string;
  shopInfo: { name: string; address: string; phone: string; gstNumber?: string };
  customerInfo: { name: string; phone: string };
  lineItems: InvoiceLineItem[];
  subtotal: number; tax: number; total: number;
  paymentStatus: "pending"|"paid"|"failed";
  paymentMethod?: string;
}

export interface CustomerJob {
  id: string; customerId: string; mechanicId?: string;
  serviceType: ServiceType; vehicleInfo: VehicleInfo;
  location: Location; description?: string; status: JobStatus;
  customerMedia: MediaItem[]; progressMedia?: MediaItem[];
  completionMedia?: MediaItem[];
  timestamps: { requested: string; accepted?: string; started?: string; completed?: string; cancelled?: string };
  mechanic?: { id: string; name: string; shopName: string; phone: string; rating: number };
  estimatedArrival?: string; rating?: number; review?: string; invoice?: Invoice;
}

export interface ServiceRequest {
  id: string; customerId: string; customerName: string; customerPhone: string;
  serviceType: ServiceType; vehicleInfo: VehicleInfo; location: Location;
  distance?: number; description?: string; media: MediaItem[];
  createdAt: string; estimatedPrice?: { min: number; max: number };
}

export interface ShopProfile {
  id: string; mechanicId: string; shopName: string; description?: string;
  location: Location; services: ServiceType[]; gstNumber?: string;
  whatsappNumber?: string; hourlyRate?: number; yearsOfExperience?: number;
  rating: number; reviewCount: number; responseRate: number; completionRate: number;
  isOnline: boolean;
}

export interface MechanicMetrics {
  totalEarnings: number; jobsCompleted: number; averageRating: number; reviewCount: number;
  responseRate: number; completionRate: number; customerSatisfaction: number;
  earningsThisMonth: number; earningsThisWeek: number; jobsThisMonth: number; jobsThisWeek: number;
}

export interface AppNotification {
  id: string; userId: string;
  type: "job_request"|"job_accepted"|"job_started"|"job_completed"|"payment_requested"|"payment_received"|"rating_received"|"message"|"info";
  title: string; message: string; read: boolean; createdAt: string;
}

export interface Review {
  id: string; jobId: string; customerId: string; mechanicId: string;
  customerName: string; rating: number; review: string; tags?: string[];
  mechanicResponse?: string; mechanicResponseAt?: string; createdAt: string;
}


export interface ChatMessage {
  id: string; jobId: string; senderId: string; senderName: string;
  senderRole: "customer"|"mechanic"; text?: string; imageUri?: string;
  createdAt: string; read: boolean;
}
