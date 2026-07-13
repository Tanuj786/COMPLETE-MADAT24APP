import React, { useState, useEffect, useRef } from "react";
import { View, Text, ScrollView, Pressable, Alert, Animated, Image, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { formatDistanceToNow } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { PulseDot, useTheme } from "~/components/ui";
import { FONTS, SERVICES } from "~/constants";
import { useMechanicStore, useNotifStore, useAuthStore } from "~/stores";
import { useSocket } from "~/hooks/useSocket";
import { BASE_URL, apiAcceptRequest, apiGetPendingRequests, apiRejectRequest } from "~/lib/api";

// ── 30-second countdown ───────────────────────────────────────────
function Countdown({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const C = useTheme();
  const [left, setLeft] = useState(seconds);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (left <= 0) { onExpire(); return; }
    const t = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  useEffect(() => {
    if (left <= 8) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 350, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ])).start();
    }
  }, [left <= 8]);

  const color = left > 15 ? C.green : left > 8 ? C.yellow : C.red;
  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: "center" }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: color + "18", borderWidth: 3, borderColor: color, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color, fontFamily: FONTS.black, fontSize: 20 }}>{left}</Text>
      </View>
      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, marginTop: 3 }}>SEC</Text>
    </Animated.View>
  );
}

// ── Customer photo preview ────────────────────────────────────────
function PhotoPreview({ media }: { media: any[] }) {
  const C = useTheme();
  const [preview, setPreview] = useState<string | null>(null);
  if (!media || media.length === 0) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 8 }}>
        📷 Vehicle photos from customer ({media.length})
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {media.map((m: any, i: number) => (
            <Pressable key={i} onPress={() => setPreview(m.uri)}>
              <Image source={{ uri: m.uri }} style={{ width: 82, height: 82, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }} />
              <View style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "#000A", borderRadius: 6, padding: 3 }}>
                <Icon name="Expand" size={9} color="white" />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} style={{ flex: 1, backgroundColor: "#000000EE", alignItems: "center", justifyContent: "center" }}>
          <Image source={{ uri: preview || "" }} style={{ width: "92%", height: 360, borderRadius: 18 }} resizeMode="contain" />
          <Pressable onPress={() => setPreview(null)} style={{ marginTop: 20, backgroundColor: "#1a1a2a", paddingHorizontal: 28, paddingVertical: 13, borderRadius: 22 }}>
            <Text style={{ color: "white", fontFamily: FONTS.semibold, fontSize: 14 }}>Close</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function Requests() {
  const C = useTheme();
  const { requests, acceptRequest, rejectRequest, removeRequest, isOnline, addIncomingRequest } = useMechanicStore();
  const { addNotification } = useNotifStore();
  const { user } = useAuthStore();
  const { socket } = useSocket();

  React.useEffect(() => {
    let cancelled = false;
    apiGetPendingRequests()
      .then(({ requests }) => {
        if (cancelled) return;
        requests.forEach((req: any) => addIncomingRequest(req));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Listen for real-time events from backend
  React.useEffect(() => {
    if (!socket) return;
    const onNew = (payload: any) => {
      // Backend sends { jobId, distance } OR a full request object
      const req = payload?.job ? payload.job : payload;
      if (!req?.id) return;
      addIncomingRequest(req);
      const { showToast } = require("~/components/ui/Toast");
      showToast(`New job nearby — ${payload?.distance?.toFixed?.(1) ?? "?"} km`, "info");
    };
    const onTaken = ({ jobId }: { jobId: string }) => {
      removeRequest(jobId);
      const { showToast } = require("~/components/ui/Toast");
      showToast("Job was taken by another mechanic", "info");
    };
    socket.on("new_job_request", onNew);
    socket.on("job_taken", onTaken);
    return () => {
      socket.off("new_job_request", onNew);
      socket.off("job_taken", onTaken);
    };
  }, [socket]);

  const svcMap = Object.fromEntries(SERVICES.map(s => [s.type, s]));
  const EMOJIS: Record<string, string> = {
    "tyre-puncture": "🔧", "fuel-delivery": "⛽", "engine-repair": "⚙️",
    "brake-repair": "🛑", "battery-jump-start": "⚡", "towing-services": "🚛",
    "oil-change": "🛢️", "ac-repair": "❄️",
  };

  const handleAccept = async (id: string) => {
    try {
      // Calls backend: POST /api/mechanic/requests/:id/accept
      // Backend handles first-accept-wins atomically (Prisma updateMany)
      await apiAcceptRequest(id);
      acceptRequest(id);
      const { showToast } = require("~/components/ui/Toast");
      showToast("Job accepted — head to Jobs tab", "success");
      if (user) {
        addNotification({
          id: `notif-${Date.now()}`, userId: user.id,
          type: "job_accepted", title: "Job Accepted ✅",
          message: "You accepted a request. Head to Jobs tab.",
          read: false, createdAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      removeRequest(id);
      const { showToast } = require("~/components/ui/Toast");
      if (err.message?.toLowerCase().includes("another mechanic") || err.message?.toLowerCase().includes("already")) {
        showToast("Too late — another mechanic took this job", "info");
      } else {
        showToast(err.message || "Failed to accept", "error");
      }
    }
  };

  const handleDecline = (id: string, name: string) => {
    Alert.alert("Decline Request", `Decline ${name}'s request?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: () => {
          rejectRequest(id);
          apiRejectRequest(id).catch(() => {});
        },
      },
    ]);
  };

  // Empty state
  if (requests.length === 0) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26 }}>Incoming Requests</Text>
        <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 }}>No pending requests</Text>
        {__DEV__ && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 10, marginTop: 4 }}>API {BASE_URL}</Text>}
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: C.bg1, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ fontSize: 42 }}>📬</Text>
        </View>
        <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 8 }}>No Incoming Requests</Text>
        <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          {isOnline
            ? "You're online. Requests from customers within 10 km will appear here."
            : "Go Online from the Dashboard to start receiving customer requests."}
        </Text>
        {!isOnline && (
          <View style={{ backgroundColor: C.primaryDim, borderRadius: 16, padding: 16, marginTop: 20, width: "100%", borderWidth: 1, borderColor: C.primary + "30" }}>
            <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 13, textAlign: "center" }}>
              💡 Go to Dashboard → tap OFFLINE to go Online
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[C.isDark ? "#0A0A1E" : "#F0F4FF", C.bg]} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <PulseDot color={C.yellow} size={5} />
          <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26 }}>Incoming Requests</Text>
        </View>
        <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>
          {requests.length} pending · Accept within 30 seconds · 10 km radius
        </Text>
        {__DEV__ && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 10, marginTop: 4 }}>API {BASE_URL}</Text>}
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}>
        {requests.map(req => {
          const svc = svcMap[req.serviceType];
          return (
            <View key={req.id} style={{ marginBottom: 16, backgroundColor: C.card, borderRadius: 22, borderWidth: 1.5, borderColor: C.yellow + "50", overflow: "hidden", shadowColor: C.yellow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 6 }}>
              <LinearGradient colors={[C.yellow + "22", "transparent"]} style={{ paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                {/* Service identity */}
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: (svc?.color || C.orange) + "20", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 24 }}>{EMOJIS[req.serviceType] || "🔧"}</Text>
                    </View>
                    <View>
                      <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 17, textTransform: "capitalize" }}>{req.serviceType.replace(/-/g, " ")}</Text>
                      {req.estimatedPrice && (
                        <Text style={{ color: C.green, fontFamily: FONTS.semibold, fontSize: 13, marginTop: 2 }}>
                          ₹{req.estimatedPrice.min} – ₹{req.estimatedPrice.max}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <Countdown seconds={30} onExpire={() => rejectRequest(req.id)} />
              </LinearGradient>

              <View style={{ padding: 18, paddingTop: 6 }}>
                {/* Customer block */}
                <View style={{ backgroundColor: C.bg1, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="User" size={20} color={C.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 14 }}>{req.customerName}</Text>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{req.customerPhone}</Text>
                    </View>
                    {req.distance !== undefined && (
                      <View style={{ backgroundColor: req.distance <= 10 ? C.green + "20" : C.orange + "20", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: req.distance <= 10 ? C.green + "50" : C.orange + "50" }}>
                        <Text style={{ color: req.distance <= 10 ? C.green : C.orange, fontFamily: FONTS.bold, fontSize: 12 }}>
                          {req.distance} km {req.distance <= 10 ? "✓" : ""}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
                    <Icon name="MapPin" size={13} color={C.text3} style={{ marginTop: 1 }} />
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13, flex: 1, lineHeight: 18 }}>
                      {req.location.address}, {req.location.city}
                    </Text>
                  </View>
                  {req.location.coordinates && (req.location.coordinates.lat !== 0 || req.location.coordinates.lng !== 0) && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Icon name="Navigation" size={11} color={C.green} />
                      <Text style={{ color: C.green, fontFamily: FONTS.regular, fontSize: 11 }}>
                        GPS: {req.location.coordinates.lat.toFixed(4)}, {req.location.coordinates.lng.toFixed(4)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Vehicle */}
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <View style={{ backgroundColor: C.primaryDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                    <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 12, textTransform: "capitalize" }}>{req.vehicleInfo.type}</Text>
                  </View>
                  {req.vehicleInfo.make && (
                    <View style={{ backgroundColor: C.bg1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>{req.vehicleInfo.make} {req.vehicleInfo.model}</Text>
                    </View>
                  )}
                </View>

                {/* Description */}
                {req.description ? (
                  <View style={{ backgroundColor: C.bg1, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, fontStyle: "italic" }}>"{req.description}"</Text>
                  </View>
                ) : null}

                {/* Customer photos */}
                <PhotoPreview media={req.media || []} />

                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginBottom: 16 }}>
                  {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                </Text>

                {/* Accept / Decline */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={() => handleDecline(req.id, req.customerName)} style={{ flex: 1, backgroundColor: C.redDim, borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1.5, borderColor: C.red + "40" }}>
                    <Text style={{ color: C.red, fontFamily: FONTS.bold, fontSize: 14 }}>Decline</Text>
                  </Pressable>
                  <Pressable onPress={() => handleAccept(req.id)} style={{ flex: 2, borderRadius: 14, overflow: "hidden" }}>
                    <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                      <Icon name="Check" size={18} color="white" />
                      <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 15 }}>Accept Request</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
