type JobForRequest = {
  id: string;
  customerId: string;
  customer?: { id: string; name: string; phone: string } | null;
  serviceType: string;
  vehicleType: string;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | null;
  licensePlate?: string | null;
  address: string;
  city: string;
  state?: string | null;
  pincode?: string | null;
  latitude: number;
  longitude: number;
  description?: string | null;
  estimatedMin?: number | null;
  estimatedMax?: number | null;
  createdAt: Date;
  media?: Array<{
    id: string;
    url: string;
    uploadedAt: Date;
    uploadedBy: string;
    mimeType?: string | null;
  }>;
};

export function toServiceRequest(job: JobForRequest, distance?: number) {
  return {
    id: job.id,
    customerId: job.customerId,
    customerName: job.customer?.name || "Customer",
    customerPhone: job.customer?.phone || "",
    serviceType: job.serviceType,
    vehicleInfo: {
      type: job.vehicleType,
      make: job.vehicleMake || undefined,
      model: job.vehicleModel || undefined,
      year: job.vehicleYear || undefined,
      licensePlate: job.licensePlate || undefined,
    },
    location: {
      address: job.address,
      city: job.city,
      state: job.state || "",
      pincode: job.pincode || "",
      coordinates: { lat: job.latitude, lng: job.longitude },
    },
    distance,
    description: job.description || undefined,
    media: (job.media || []).map(m => ({
      id: m.id,
      type: m.mimeType?.startsWith("video/") ? "video" : "photo",
      uri: m.url,
      uploadedAt: m.uploadedAt.toISOString(),
      uploadedBy: m.uploadedBy,
    })),
    createdAt: job.createdAt.toISOString(),
    estimatedPrice:
      job.estimatedMin != null && job.estimatedMax != null
        ? { min: job.estimatedMin, max: job.estimatedMax }
        : undefined,
  };
}
