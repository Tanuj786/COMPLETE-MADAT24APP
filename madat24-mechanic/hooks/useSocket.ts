/**
 * SOCKET.IO HOOK — React Native / Expo Go compatible
 *
 * Root causes of "websocket error" fixed here:
 *
 * 1. IP was hardcoded — now reads from BASE_URL in lib/api.ts
 * 2. transports:["polling","websocket"] breaks RN because React Native
 *    does NOT support XHR streaming needed for polling transport.
 *    Fixed: websocket ONLY — matches backend config.
 * 3. Local offline tokens ("local_...") were sent to backend → rejected.
 *    Fixed: skip socket entirely for offline accounts.
 * 4. globalSocket was never cleaned up on token change.
 *    Fixed: disconnect + recreate when token changes.
 */

import { useEffect, useRef, useState } from "react";
import { BASE_URL, getToken } from "~/lib/api";

// Strip "/api" suffix to get the raw server URL
// "http://192.168.1.25:4000/api"  →  "http://192.168.1.25:4000"
const SOCKET_URL = BASE_URL.replace(/\/api\/?$/, "");

let globalSocket: any   = null;
let globalToken:  string | null = null;

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const ref = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const token = await getToken();

      // ── Skip socket for offline / unauthenticated users ──────────
      // Local tokens start with "local_" — backend will reject them.
      // No backend = no real-time features needed anyway.
      if (!token || token.startsWith("local_")) {
        return;
      }

      // ── Recreate socket if token changed (e.g. re-login) ─────────
      if (globalSocket && globalToken !== token) {
        globalSocket.removeAllListeners();
        globalSocket.disconnect();
        globalSocket = null;
        globalToken  = null;
      }

      // ── Create socket if not exists ───────────────────────────────
      if (!globalSocket) {
        try {
          const { io } = await import("socket.io-client");

          globalSocket = io(SOCKET_URL, {
            auth:      { token },

            // CRITICAL for React Native:
            // "polling" uses XHR streaming which RN cannot do.
            // Use "websocket" ONLY — matches the backend's transports config.
            transports: ["websocket"],

            // Reconnect settings
            reconnection:         true,
            reconnectionAttempts: 8,
            reconnectionDelay:    2000,
            reconnectionDelayMax: 10000,

            // Connection timeout
            timeout: 15000,

            // Force a new connection (don't reuse stale ones)
            forceNew: false,
          });

          globalToken = token;
        } catch (err) {
          console.warn("[Socket] Init error:", err);
          return;
        }
      }

      ref.current = globalSocket;

      // ── Event handlers ────────────────────────────────────────────
      const onConnect = () => {
        console.log("[Socket] ✅ Connected to", SOCKET_URL);
        if (mounted) setConnected(true);
      };

      const onDisconnect = (reason: string) => {
        console.log("[Socket] Disconnected:", reason);
        if (mounted) setConnected(false);
      };

      const onError = (err: any) => {
        const msg = err?.message || String(err);
        if (
          msg.includes("Invalid") ||
          msg.includes("No token") ||
          msg.includes("Offline token")
        ) {
          // Token was rejected — clean up silently, don't spam logs
          globalSocket?.removeAllListeners();
          globalSocket?.disconnect();
          globalSocket = null;
          globalToken  = null;
        } else {
          console.warn("[Socket] Connect error:", msg);
        }
      };

      globalSocket.on("connect",       onConnect);
      globalSocket.on("disconnect",    onDisconnect);
      globalSocket.on("connect_error", onError);

      // If already connected from a previous render
      if (globalSocket.connected && mounted) setConnected(true);

      cleanup = () => {
        globalSocket?.off("connect",       onConnect);
        globalSocket?.off("disconnect",    onDisconnect);
        globalSocket?.off("connect_error", onError);
      };
    })();

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, []);

  return { socket: ref.current, connected };
}

// ── Emit helpers — all null-safe ──────────────────────────────────
export const joinJobRoom        = (s: any, jobId: string)                    => s?.emit("join_job",        { jobId });
export const leaveJobRoom       = (s: any, jobId: string)                    => s?.emit("leave_job",       { jobId });
export const sendLocationUpdate = (s: any, lat: number, lng: number, jobIds?: string[]) => s?.emit("location_update", { latitude: lat, longitude: lng, jobIds });
export const trackMechanic      = (s: any, mechanicId: string)               => s?.emit("track_mechanic",  { mechanicId });
export const sendTyping         = (s: any, jobId: string, isTyping: boolean) => s?.emit("typing",          { jobId, isTyping });

export const disconnectSocket = () => {
  globalSocket?.removeAllListeners();
  globalSocket?.disconnect();
  globalSocket = null;
  globalToken  = null;
};
