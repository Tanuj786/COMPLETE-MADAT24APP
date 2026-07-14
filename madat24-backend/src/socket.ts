import { Server as IOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { verifyToken, JwtPayload } from "./auth";

let io: IOServer | null = null;

export function initSocket(server: HttpServer): IOServer {
  io = new IOServer(server, {
    cors: { origin: "*" },
    transports: ["websocket"], // matches the RN client (polling not supported in RN)
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("No token"));
    if (token.startsWith("local_")) return next(new Error("Offline token"));
    try {
      const payload = verifyToken(token);
      (socket.data as any).user = payload;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const user = (socket.data as any).user as JwtPayload;
    // Personal room for this user — used for direct emits (notifications etc.)
    socket.join(`user:${user.id}`);
    console.log(`[socket] connected user=${user.id} role=${user.role}`);

    socket.on("join_job", ({ jobId }: { jobId: string }) => {
      if (jobId) socket.join(`job:${jobId}`);
    });
    socket.on("leave_job", ({ jobId }: { jobId: string }) => {
      if (jobId) socket.leave(`job:${jobId}`);
    });
    socket.on("location_update", (payload: { latitude: number; longitude: number; jobId?: string; jobIds?: string[] }) => {
      // Forward live GPS to active job rooms. DB persistence is handled by REST PATCH /mechanic/location.
      const jobIds = [payload.jobId, ...(payload.jobIds || [])].filter(Boolean) as string[];
      for (const jobId of new Set(jobIds)) {
        socket.to(`job:${jobId}`).emit("mechanic_location", { mechanicId: user.id, jobId, latitude: payload.latitude, longitude: payload.longitude });
      }
      socket.to(`mechanic:${user.id}`).emit("mechanic_location", { mechanicId: user.id, latitude: payload.latitude, longitude: payload.longitude });
    });
    socket.on("track_mechanic", ({ mechanicId }: { mechanicId: string }) => {
      if (mechanicId) socket.join(`mechanic:${mechanicId}`);
    });
    socket.on("typing", ({ jobId, isTyping }: { jobId: string; isTyping: boolean }) => {
      if (jobId) socket.to(`job:${jobId}`).emit("typing", { userId: user.id, isTyping });
    });

    socket.on("disconnect", (reason) => {
      console.log(`[socket] disconnected user=${user.id} reason=${reason}`);
    });
  });

  return io;
}

// ─── Helpers used by REST routes to broadcast events ──────────────
export function emitToUser(userId: string, event: string, payload: any) {
  io?.to(`user:${userId}`).emit(event, payload);
}
export function emitToJob(jobId: string, event: string, payload: any) {
  io?.to(`job:${jobId}`).emit(event, payload);
}
export function broadcast(event: string, payload: any) {
  io?.emit(event, payload);
}
