import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Icon from "~/lib/icons/Icon";
import { ProgressBar, PulseDot, useTheme } from "~/components/ui";
import { FONTS } from "~/constants";
import { useAuthStore, useMechanicStore, useNearbyStore } from "~/stores";
import { useSocket, sendLocationUpdate } from "~/hooks/useSocket";
import { apiToggleOnline, apiUpdateLocation } from "~/lib/api";
import { showToast } from "~/components/ui/Toast";
import { AnimatedNumber } from "~/components/ui/AnimatedNumber";
import { PressableScale } from "~/components/ui/PressableScale";

export default function MechanicDashboard() {
  const C = useTheme();
  const { user } = useAuthStore();
  const { isOnline, toggleOnline, metrics, requests, activeJobs, shopProfile } = useMechanicStore();
  const { registerMechanic, updateMechanicOnline } = useNearbyStore();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Register mechanic location when dashboard mounts / online status changes
  useEffect(() => {
    if (!user) return;
    const mechanicId = user.id;
    // Get real GPS position for the mechanic
    (async () => {
      try {
        const ExpoLoc = require("expo-location");
        const { status } = await ExpoLoc.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await ExpoLoc.getCurrentPositionAsync({
            accuracy: ExpoLoc.Accuracy.Highest,
            maximumAge: 0,
            timeout: 15000,
          });
          registerMechanic({
            mechanicId,
            name: user.name,
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            isOnline,
          });
          return;
        }
      } catch {}
      // Fallback: register at 0,0 — won't match real customer requests
      registerMechanic({ mechanicId, name: user.name, lat: 0, lng: 0, isOnline });
    })();
  }, [user?.id]);

  // Keep nearby registry in sync with online toggle
  useEffect(() => {
    if (user) updateMechanicOnline(user.id, isOnline);
    // Tell backend about online status change
    apiToggleOnline(isOnline).catch(() => {});
  }, [isOnline, user?.id]);

  // Send live GPS to backend every 10 seconds while online
  const { socket } = useSocket();
  useEffect(() => {
    if (!isOnline || !user) return;
    const interval = setInterval(async () => {
      try {
        const ExpoLoc = require("expo-location");
        const { status } = await ExpoLoc.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await ExpoLoc.getCurrentPositionAsync({ accuracy: ExpoLoc.Accuracy.Balanced });
          const { latitude, longitude } = loc.coords;
          // Send via Socket.IO (fast) and REST API (persistent)
          sendLocationUpdate(socket, latitude, longitude);
          apiUpdateLocation(latitude, longitude, true).catch(() => {});
        }
      } catch {}
    }, 10000); // every 10 seconds
    return () => clearInterval(interval);
  }, [isOnline, socket, user?.id]);

  // Top-level socket listeners for cross-screen toasts
  useEffect(() => {
    if (!socket) return;
    const onNewJob = (payload: any) => {
      showToast(`New job nearby — ${payload?.distance?.toFixed?.(1) ?? "?"} km`, "info");
    };
    const onPaid = (payload: any) => {
      showToast(`Payment received: ₹${payload?.total?.toFixed?.(0) ?? ""}`, "success");
    };
    socket.on("new_job_request", onNewJob);
    socket.on("payment_received", onPaid);
    return () => { socket.off("new_job_request", onNewJob); socket.off("payment_received", onPaid); };
  }, [socket]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // KPIs — all start at 0. Update only when real jobs happen.
  const kpis = [
    { label: "TOTAL EARNED", value: `₹${metrics.totalEarnings.toLocaleString("en-IN")}`,   sub: metrics.earningsThisWeek > 0 ? `+₹${metrics.earningsThisWeek.toLocaleString("en-IN")} this week` : "No earnings yet",  color: C.green,   emoji: "💰" },
    { label: "JOBS DONE",    value: String(metrics.jobsCompleted),                          sub: metrics.jobsThisWeek > 0    ? `${metrics.jobsThisWeek} this week` : "No jobs yet",                                        color: C.primary, emoji: "✅" },
    { label: "RATING",       value: metrics.reviewCount > 0 ? metrics.averageRating.toFixed(1) : "—", sub: metrics.reviewCount > 0 ? `${metrics.reviewCount} review${metrics.reviewCount > 1 ? "s" : ""}` : "No reviews yet", color: C.yellow, emoji: "⭐" },
    { label: "RESPONSE",     value: metrics.responseRate > 0 ? `${metrics.responseRate}%` : "—",   sub: "acceptance rate",                                                                                                   color: C.orange,  emoji: "⚡" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Header */}
        <LinearGradient colors={[C.isDark ? "#0A0A0A" : "#F0F4FF", C.bg]} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Top bar: Logo + Online toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              {/* MADAT24 Logo */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: "#0F0F0F", borderWidth: 1.5, borderColor: "#1E1E1E", alignItems: "center", justifyContent: "center", shadowColor: "#F97316", shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 }}>
                  <Text style={{ color: "#F97316", fontFamily: FONTS.black, fontSize: 20, letterSpacing: -1 }}>M</Text>
                  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, backgroundColor: "#2563EB" }} />
                </View>
                <View>
                  <Text style={{ fontFamily: FONTS.black, fontSize: 16, letterSpacing: -0.5 }} numberOfLines={1}>
                    <Text style={{ color: "#F97316" }}>MADAT</Text><Text style={{ color: "#2563EB" }}>24</Text><Text style={{ color: "#F97316", fontSize: 11 }}>/7</Text>
                  </Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, letterSpacing: 1.5 }}>MECHANIC</Text>
                </View>
              </View>
              <PressableScale haptic={isOnline ? "warning" : "success"} onPress={() => { toggleOnline(); showToast(isOnline ? "You're now offline" : "You're online — receiving jobs", isOnline ? "info" : "success"); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: isOnline ? C.green + "18" : C.bg1, borderWidth: 1.5, borderColor: isOnline ? C.green + "60" : C.border }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOnline ? C.green : C.text3 }} />
                <Text style={{ color: isOnline ? C.green : C.text2, fontFamily: FONTS.bold, fontSize: 13 }}>{isOnline ? "ONLINE" : "OFFLINE"}</Text>
              </PressableScale>
            </View>
            {/* Name + status */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 22, marginBottom: 2 }}>{user?.name || "Mechanic"}</Text>
                {shopProfile && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginBottom: 4 }}>{shopProfile.shopName}</Text>}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {isOnline
                    ? <><PulseDot color={C.green} size={4} /><Text style={{ color: C.green, fontFamily: FONTS.semibold, fontSize: 12 }}>Online — accepting requests</Text></>
                    : <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Go online to receive requests</Text>
                  }
                </View>
              </View>
            </View>

            {/* Industrial chrome strip */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.isDark ? "#0F1620" : "#E6EEFC", borderWidth: 1, borderColor: (isOnline ? C.green : "#2563EB") + "33", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Text style={{ fontSize: 11 }}>{isOnline ? "🛰️" : "📡"}</Text>
                <Text style={{ color: isOnline ? C.green : "#2563EB", fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.8 }}>{isOnline ? "BROADCASTING" : "STANDBY"}</Text>
              </View>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 10 }}>
                {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
                  <View key={i} style={{ flex: 1, height: i % 3 === 0 ? 6 : 2.5, borderRadius: 1, backgroundColor: i % 3 === 0 ? "#F9731633" : "#2A2A2A" }} />
                ))}
              </View>
              <Text style={{ color: C.text3, fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 1 }}>24/7</Text>
            </View>
          </Animated.View>
        </LinearGradient>

        {/* Go-online prompt when offline */}
        {!isOnline && (
          <Pressable onPress={toggleOnline} style={{ margin: 16, marginBottom: 8 }}>
            <LinearGradient colors={[C.primary, C.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 18, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "#ffffff25", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 24 }}>🔔</Text>
                </View>
                <View>
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Go Online to Earn</Text>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>Start receiving customer requests</Text>
                </View>
              </View>
              <Icon name="ArrowRight" size={22} color="white" />
            </LinearGradient>
          </Pressable>
        )}

        {/* Incoming requests alert */}
        {requests.length > 0 && (
          <Pressable onPress={() => router.push("/(mechanic)/requests")} style={{ marginHorizontal: 16, marginTop: isOnline ? 16 : 8, marginBottom: 4 }}>
            <LinearGradient colors={[C.yellow, "#E8A000"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: C.yellow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: "#ffffff25", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 26 }}>🔔</Text>
                </View>
                <View>
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 17 }}>{requests.length} New Request{requests.length > 1 ? "s" : ""}!</Text>
                  <Text style={{ color: "#ffffff99", fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>Tap to review and accept</Text>
                </View>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#ffffff25", alignItems: "center", justifyContent: "center" }}>
                <Icon name="ArrowRight" size={18} color="white" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* KPI Grid */}
        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 14, paddingTop: 20, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {kpis.map((k, i) => (
              <View key={i} style={{ width: "47.5%", backgroundColor: C.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: k.color + "25" }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: C.text3, fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 1.5 }}>{k.label}</Text>
                  <Text style={{ fontSize: 20 }}>{k.emoji}</Text>
                </View>
                <Text style={{ color: k.value === "—" ? C.text3 : k.color, fontFamily: FONTS.black, fontSize: 22, marginBottom: 4 }}>{k.value}</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>{k.sub}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Live Status */}
        <View style={{ marginHorizontal: 16, marginTop: 20, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.cardBorder, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>📊</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Live Status</Text>
            </View>
            {isOnline && <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><PulseDot color={C.green} size={4} /><Text style={{ color: C.green, fontFamily: FONTS.semibold, fontSize: 12 }}>Live</Text></View>}
          </View>
          <View style={{ flexDirection: "row" }}>
            {[
              { v: requests.length,           l: "Pending",   c: C.yellow,  r: "/(mechanic)/requests" },
              { v: activeJobs.length,          l: "Active",    c: C.primary, r: "/(mechanic)/jobs"     },
              { v: metrics.jobsThisWeek || 0,  l: "This Week", c: C.green,   r: null                   },
            ].map((item, i) => (
              <PressableScale key={i} onPress={() => item.r && router.push(item.r as any)} style={{ flex: 1, alignItems: "center", paddingVertical: 22, borderRightWidth: i < 2 ? 1 : 0, borderRightColor: C.border }}>
                <AnimatedNumber value={item.v} style={{ color: item.v === 0 ? C.text3 : item.c, fontFamily: FONTS.black, fontSize: 32 }} />
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 5 }}>{item.l}</Text>
              </PressableScale>
            ))}
          </View>
        </View>

        {/* Performance — shows "—" when no data */}
        <View style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
            <Text style={{ fontSize: 16 }}>📈</Text>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Performance</Text>
            {metrics.jobsCompleted === 0 && (
              <View style={{ backgroundColor: C.primaryDim, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                <Text style={{ color: C.primary, fontFamily: FONTS.regular, fontSize: 11 }}>Updates after jobs</Text>
              </View>
            )}
          </View>
          {metrics.jobsCompleted === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
                Accept and complete jobs to see your performance metrics here
              </Text>
            </View>
          ) : (
            <View style={{ gap: 16 }}>
              <ProgressBar label="Customer Satisfaction" value={metrics.customerSatisfaction} color={C.green} />
              <ProgressBar label="Response Rate"         value={metrics.responseRate}         color={C.primary} />
              <ProgressBar label="Completion Rate"       value={metrics.completionRate}       color={C.orange} />
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
