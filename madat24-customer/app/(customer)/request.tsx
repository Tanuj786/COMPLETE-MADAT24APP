/**
 * Customer Request Flow — as per user's notes:
 * Step 1: Set location (Live GPS or Manual)
 * Step 2: Vehicle type (Car/Bike/Electric Bike/Cycle/Truck/Electric Car)
 * Step 3: Service type (General Repair/Puncture/Towing/Tyre Purchase + more)
 * Step 4: Searching nearby mechanics (Ola/Uber style — notifies all, first to accept gets job)
 *         Shows shops + public mechanics nearby within 10km
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, Animated, ScrollView,
  TextInput, Alert, ActivityIndicator, Dimensions, StyleSheet, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import Icon from "~/lib/icons/Icon";
import { FONTS } from "~/constants";
import { useTheme } from "~/components/ui";
import { useAuthStore, useCustomerStore } from "~/stores";
import { BASE_URL, apiCancelJob, apiCreateJob, apiGetMyJobs, apiGetNearbyMechanics } from "~/lib/api";
import type { NearbyMechanic } from "~/lib/api";
import { useSocket } from "~/hooks/useSocket";

const { width } = Dimensions.get("window");

// ─── Brand colors ─────────────────────────────────────────────────
const ORANGE  = "#F97316";
const ORANGE2 = "#EA6C0A";
const TEAL    = "#06B6D4";

// ─── Data ─────────────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { id: "car",           label: "Car",           emoji: "🚗", color: "#3B82F6" },
  { id: "bike",          label: "Bike",          emoji: "🏍️", color: ORANGE   },
  { id: "electric-bike", label: "Electric Bike", emoji: "⚡", color: TEAL     },
  { id: "cycle",         label: "Cycle",         emoji: "🚲", color: "#22C55E" },
  { id: "truck",         label: "Truck",         emoji: "🚛", color: "#9333EA" },
  { id: "electric-car",  label: "Electric Car",  emoji: "🔋", color: "#06B6D4" },
];

const SERVICE_TYPES = [
  { id: "engine-repair",    label: "Engine Repair",    emoji: "⚙️", color: "#3B82F6", desc: "Diagnosis & repair"          },
  { id: "tyre-puncture",    label: "Puncture Fix",     emoji: "🔧", color: ORANGE,    desc: "Tube/tubeless repair"         },
  { id: "towing-services",  label: "Towing",           emoji: "🚛", color: "#9333EA", desc: "Tow to nearest garage"        },
  { id: "tyre-purchase",    label: "Tyre Purchase",    emoji: "🛞", color: "#22C55E", desc: "New tyre supply & fitting"    },
  { id: "general-repair",   label: "General Repair",   emoji: "🔩", color: "#F59E0B", desc: "Any other mechanical issue"   },
  { id: "battery-jump-start",label: "Battery/Jump",   emoji: "⚡", color: TEAL,      desc: "Jump-start or replace battery" },
  { id: "brake-repair",     label: "Brake Repair",     emoji: "🛑", color: "#EF4444", desc: "Brake pads, discs, fluid"     },
  { id: "oil-change",       label: "Oil Change",       emoji: "🛢️", color: "#8B5CF6", desc: "Engine oil + filter"          },
  { id: "ac-repair",        label: "AC Repair",        emoji: "❄️", color: "#06B6D4", desc: "Cooling system"               },
  { id: "fuel-delivery",    label: "Fuel Delivery",    emoji: "⛽", color: "#F97316", desc: "Emergency fuel"               },
];

// ─── Step indicators ──────────────────────────────────────────────
function StepBar({ step }: { step: number }) {
  const C = useTheme();
  const steps = ["Location", "Vehicle", "Service", "Confirm"];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 }}>
      {steps.map((s, i) => {
        const done   = step > i + 1;
        const active = step === i + 1;
        return (
          <React.Fragment key={i}>
            <View style={{ alignItems: "center" }}>
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: done ? ORANGE : active ? ORANGE + "20" : C.bg2,
                borderWidth: active ? 2 : 1,
                borderColor: done || active ? ORANGE : C.border,
                alignItems: "center", justifyContent: "center",
              }}>
                {done
                  ? <Text style={{ color: "white", fontSize: 14 }}>✓</Text>
                  : <Text style={{ color: active ? ORANGE : C.text3, fontFamily: FONTS.bold, fontSize: 12 }}>{i + 1}</Text>
                }
              </View>
              <Text style={{ color: active ? ORANGE : C.text3, fontFamily: active ? FONTS.semibold : FONTS.regular, fontSize: 9, marginTop: 4 }}>{s}</Text>
            </View>
            {i < 3 && (
              <View style={{ flex: 1, height: 2, backgroundColor: done ? ORANGE : C.border, marginBottom: 14, marginHorizontal: 4 }} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Animated card ────────────────────────────────────────────────
function AnimCard({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: any }) {
  const op = useRef(new Animated.Value(0)).current;
  const y  = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(y,  { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity: op, transform: [{ translateY: y }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Searching animation ──────────────────────────────────────────
function SearchingRadar({ vehicleType, serviceType }: { vehicleType: string; serviceType: string }) {
  const C     = useTheme();
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const rot   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ]));

    pulse(ring1, 0).start();
    pulse(ring2, 600).start();
    pulse(ring3, 1200).start();

    Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const v = VEHICLE_TYPES.find(v => v.id === vehicleType);
  const s = SERVICE_TYPES.find(s => s.id === serviceType);

  return (
    <View style={{ alignItems: "center", paddingVertical: 24 }}>
      <View style={{ width: 180, height: 180, alignItems: "center", justifyContent: "center" }}>
        {[ring1, ring2, ring3].map((r, i) => (
          <Animated.View key={i} style={{
            position: "absolute",
            width: 60 + i * 40, height: 60 + i * 40,
            borderRadius: (60 + i * 40) / 2,
            borderWidth: 1.5,
            borderColor: ORANGE,
            opacity: r.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.3, 0] }),
            transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }],
          }} />
        ))}
        {/* Center dot */}
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <Text style={{ fontSize: 28 }}>{v?.emoji || "🔧"}</Text>
        </View>
        {/* Rotating scanner line */}
        <Animated.View style={{
          position: "absolute", width: 90, height: 2,
          backgroundColor: ORANGE + "60",
          left: "50%", top: "50%",
          marginTop: -1,
          transformOrigin: "left center",
          transform: [{ rotate: spin }],
        }} />
        {/* Mechanic dots */}
        {[{ top: 12, left: 18 }, { top: 28, right: 14 }, { bottom: 20, left: 30 }].map((pos, i) => (
          <View key={i} style={{
            position: "absolute", width: 10, height: 10, borderRadius: 5,
            backgroundColor: TEAL, ...pos,
            shadowColor: TEAL, shadowOpacity: 1, shadowRadius: 4,
          }} />
        ))}
      </View>
      <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 20, marginTop: 8 }}>
        Searching Mechanics
      </Text>
      <Text style={{ color: "#AAAAAA", fontFamily: FONTS.regular, fontSize: 13, marginTop: 6, textAlign: "center" }}>
        Notifying all mechanics within 10km{"\n"}First to accept gets the job · Ola/Uber style
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <View style={{ backgroundColor: ORANGE + "20", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: ORANGE + "40" }}>
          <Text style={{ color: ORANGE, fontFamily: FONTS.semibold, fontSize: 12 }}>{v?.label} · {s?.label}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Mechanic card — shows photo/avatar, name, phone, shop, distance ──
function MechanicCard({ mech, delay }: { mech: NearbyMechanic; delay: number }) {
  const op  = useRef(new Animated.Value(0)).current;
  const y   = useRef(new Animated.Value(30)).current;
  const sc  = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(y,  { toValue: 0, tension: 85, friction: 9, useNativeDriver: true }),
        Animated.spring(sc, { toValue: 1, tension: 85, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Derive color from mechanic id (consistent per mechanic)
  const MCOLORS = ["#3B82F6","#F97316","#9333EA","#22C55E","#06B6D4","#F59E0B"];
  const mechColor = MCOLORS[(mech.id.charCodeAt(0) + (mech.id.charCodeAt(1)||0)) % MCOLORS.length];
  const initials = mech.name.split(" ").map((n:string)=>n[0]).join("").slice(0,2).toUpperCase();
  const typeLabel = mech.vehicleTypes?.length > 0
    ? mech.vehicleTypes.slice(0,2).map((v:string)=>v.charAt(0).toUpperCase()+v.slice(1)).join(" · ")
    : "General Mechanic";

  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: y }, { scale: sc }], marginBottom: 12 }}>
      <View style={{
        backgroundColor: "#111111",
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: mech.isVerified ? mechColor + "35" : "#2A2A2A",
        overflow: "hidden",
      }}>
        {/* Colored top accent line */}
        <View style={{ height: 3, backgroundColor: mechColor, width: "100%" }} />

        <View style={{ padding: 16 }}>
          {/* Row 1: Avatar + Name/Shop + notified status */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>

            {/* Profile photo / avatar */}
            <View style={{
              width: 58, height: 58, borderRadius: 18,
              backgroundColor: mechColor + "22",
              borderWidth: 2, borderColor: mechColor + "50",
              alignItems: "center", justifyContent: "center",
              shadowColor: mechColor, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5,
            }}>
              <Text style={{ color: mechColor, fontFamily: FONTS.black, fontSize: 20, letterSpacing: -0.5 }}>
                {initials}
              </Text>
              {mech.isVerified && (
                <View style={{
                  position: "absolute", bottom: -4, right: -4,
                  width: 18, height: 18, borderRadius: 9,
                  backgroundColor: "#06B6D4",
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 2, borderColor: "#111111",
                }}>
                  <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900" }}>✓</Text>
                </View>
              )}
            </View>

            {/* Name + shop */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 16 }}>{mech.name}</Text>
                {mech.isVerified && (
                  <View style={{ backgroundColor: "#06B6D420", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "#06B6D440" }}>
                    <Text style={{ color: "#06B6D4", fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.5 }}>VERIFIED</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "#AAAAAA", fontFamily: FONTS.semibold, fontSize: 13, marginBottom: 2 }}>{mech.shopName || "Mechanic"}</Text>
              <Text style={{ color: "#666666", fontFamily: FONTS.regular, fontSize: 11 }}>{typeLabel}</Text>
            </View>

            {/* Notified status */}
            <View style={{ borderRadius: 14, overflow: "hidden" }}>
              <LinearGradient colors={[TEAL, "#0891B2"]} style={{ paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 12 }}>Notified</Text>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontFamily: FONTS.regular, fontSize: 10 }}>Can accept</Text>
              </LinearGradient>
            </View>
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#1E1E1E", marginVertical: 12 }} />

          {/* Row 2: Rating · Distance · Phone · ETA */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {/* Rating */}
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ color: "#F59E0B", fontFamily: FONTS.black, fontSize: 15 }}>★ {mech.rating}</Text>
              <Text style={{ color: "#555555", fontFamily: FONTS.regular, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Rating</Text>
            </View>

            <View style={{ width: 1, height: 30, backgroundColor: "#2A2A2A" }} />

            {/* Distance — prominent */}
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ color: mechColor, fontFamily: FONTS.black, fontSize: 18 }}>{mech.dist} km</Text>
              <Text style={{ color: "#555555", fontFamily: FONTS.regular, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Distance</Text>
            </View>

            <View style={{ width: 1, height: 30, backgroundColor: "#2A2A2A" }} />

            {/* ETA */}
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ color: "#06B6D4", fontFamily: FONTS.black, fontSize: 15 }}>⏱ {mech.eta}</Text>
              <Text style={{ color: "#555555", fontFamily: FONTS.regular, fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>ETA</Text>
            </View>

            <View style={{ width: 1, height: 30, backgroundColor: "#2A2A2A" }} />

            {/* Phone */}
            <View style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ color: "#22C55E", fontFamily: FONTS.semibold, fontSize: 12 }}>📞 Call</Text>
              <Text style={{ color: "#555555", fontFamily: FONTS.regular, fontSize: 9 }}>{mech.phone.slice(-5)}</Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function CustomerRequest() {
  const C = useTheme();
  const { user } = useAuthStore();
  const { syncJobsFromBackend } = useCustomerStore();
  const params = useLocalSearchParams<{ service?: string }>();

  const [step, setStep]         = useState(1);
  const [locMode, setLocMode]   = useState<"live" | "manual" | null>(null);
  const [address, setAddress]   = useState("");
  const [city, setCity]         = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [coords, setCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [vehicleType, setVehicleType] = useState(params.service ? "" : "");
  const [serviceType, setServiceType] = useState(params.service || "");
  const [description, setDesc]  = useState("");
  const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]); // optional vehicle photos
  const [searching, setSearching] = useState(false);
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [acceptedMechanic, setAcceptedMechanic] = useState<NearbyMechanic | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const { socket } = useSocket();

  // Auto-pre-select service from params
  useEffect(() => {
    if (params.service) setServiceType(params.service);
  }, []);

  const pickVehiclePhoto = async () => {
    if (vehiclePhotos.length >= 4) { Alert.alert("Max 4 photos", "Remove one to add another"); return; }
    Alert.alert("Add Vehicle Photo", "Choose source", [
      {
        text: "📷 Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow camera in settings"); return; }
          const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.75 });
          if (!res.canceled && res.assets[0]) setVehiclePhotos(p => [...p, res.assets[0].uri]);
        },
      },
      {
        text: "🖼️ Gallery",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow gallery in settings"); return; }
          const res = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true, aspect: [4, 3], quality: 0.75,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
          if (!res.canceled && res.assets[0]) setVehiclePhotos(p => [...p, res.assets[0].uri]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const getLiveLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Please allow location access in settings.");
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (geo.length > 0) {
        const g = geo[0];
        setAddress(`${g.name || ""} ${g.street || ""}`.trim() || "Current location");
        setCity(g.city || g.subregion || g.region || "");
      }
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setLocMode("live");
    } catch (e) {
      Alert.alert("Error", "Could not get location. Try entering manually.");
    }
    setLocLoading(false);
  };

  const goNext = () => {
    if (step === 1) {
      if (!address.trim()) { Alert.alert("Required", "Please set your location first"); return; }
      setStep(2);
    } else if (step === 2) {
      if (!vehicleType) { Alert.alert("Required", "Please select your vehicle type"); return; }
      setStep(3);
    } else if (step === 3) {
      if (!serviceType) { Alert.alert("Required", "Please select the service you need"); return; }
      setStep(4);
      startSearch();
    }
  };

  const startSearch = async () => {
    setSearching(true);
    setMechanics([]);

    const lat = coords?.lat ?? 28.6139;
    const lng = coords?.lng ?? 77.2090;

    // Step 1 — Create job on backend.
    // This instantly broadcasts a push notification to ALL online mechanics
    // within 10km: "Apke paas request aayi hai, ek customer hai yeh yeh need hai"
    let createdJobId: string | null = null;
    try {
      const result = await apiCreateJob({
        serviceType,
        vehicleType,
        address:     address  || "Current location",
        city:        city     || "Unknown",
        latitude:    lat,
        longitude:   lng,
        description,
      });
      createdJobId = result?.job?.id ?? null;
      setActiveJobId(createdJobId);
      apiGetMyJobs().then(({ jobs }) => syncJobsFromBackend(jobs)).catch(() => {});
    } catch (err: any) {
      setSearching(false);
      setStep(3);
      Alert.alert("Request Not Created", err?.message || "Could not create request on the server.");
      return;
    }

    // Step 2 — Listen on Socket.IO for the first mechanic to accept.
    // Backend uses atomic DB transaction → only 1 mechanic wins.
    // All others see "request_taken" and it disappears from their queue.
    if (socket && createdJobId) {
      socket.on("job_accepted", (data: any) => {
        if (data.jobId === createdJobId) {
          socket.off("job_accepted");
          socket.off("request_taken");
          // Find the accepting mechanic in our list (if loaded)
          const found = mechanics.find(m => m.id === data.mechanicId) ?? data.mechanic ?? null;
          setAcceptedMechanic(found);
          setSubmitted(true);
        }
      });
    }

    // Step 3 — Fetch ONLY real registered mechanics within 10km.
    // If none are registered/online → show empty state. No fake data ever.
    try {
      const { mechanics: nearby } = await apiGetNearbyMechanics(lat, lng);
      setMechanics(nearby);
    } catch {
      setMechanics([]); // backend offline → empty, no mock fallback
    }

    setSearching(false);
  };

  const cancelActiveRequest = () => {
    if (!activeJobId || cancelling) return;
    Alert.alert("Cancel Request", "Cancel this service request?", [
      { text: "Keep Waiting", style: "cancel" },
      {
        text: "Cancel Request",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelling(true);
            await apiCancelJob(activeJobId);
            apiGetMyJobs().then(({ jobs }) => syncJobsFromBackend(jobs)).catch(() => {});
            socket?.off("job_accepted");
            setActiveJobId(null);
            setSubmitted(false);
            setAcceptedMechanic(null);
            setMechanics([]);
            setStep(1);
            const { showToast } = require("~/components/ui/Toast");
            showToast("Request cancelled", "info");
            router.replace("/(customer)/dashboard");
          } catch (err: any) {
            const { showToast } = require("~/components/ui/Toast");
            showToast(err?.message || "Could not cancel request", "error");
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };


  if (submitted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <SuccessAnimation />

        <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 24, marginTop: 24, textAlign: "center" }}>
          {acceptedMechanic ? "Mechanic Accepted! ⚡" : "Request Sent! 📡"}
        </Text>
        <Text style={{ color: "#AAAAAA", fontFamily: FONTS.regular, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
          {acceptedMechanic
            ? "Your mechanic confirmed the job.\nThey are on their way to you."
            : "All nearby mechanics have been notified.\nFirst to accept gets your job automatically."}
        </Text>

        {/* Accepted mechanic card */}
        {acceptedMechanic && (
          <View style={{
            marginTop: 24, width: "100%",
            backgroundColor: "#141414", borderRadius: 20,
            padding: 20, borderWidth: 1.5, borderColor: "#F9731640",
          }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <View style={{
                width: 60, height: 60, borderRadius: 18,
                backgroundColor: "#F9731622", borderWidth: 2, borderColor: "#F9731650",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ color: "#F97316", fontFamily: FONTS.black, fontSize: 22 }}>
                  {acceptedMechanic.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 17 }}>
                  {acceptedMechanic.name}
                </Text>
                <Text style={{ color: "#AAAAAA", fontFamily: FONTS.regular, fontSize: 13, marginTop: 2 }}>
                  {acceptedMechanic.shopName || "Independent Mechanic"}
                </Text>
                {acceptedMechanic.isVerified && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#06B6D4" }} />
                    <Text style={{ color: "#06B6D4", fontFamily: FONTS.semibold, fontSize: 11 }}>VERIFIED</Text>
                  </View>
                )}
              </View>
              <Text style={{ color: "#F59E0B", fontFamily: FONTS.black, fontSize: 18 }}>
                ★ {typeof acceptedMechanic.rating === "number" ? acceptedMechanic.rating.toFixed(1) : "—"}
              </Text>
            </View>

            {/* Details row */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 18 }}>📞</Text>
                <Text style={{ color: "#22C55E", fontFamily: FONTS.bold, fontSize: 13 }}>Call</Text>
                <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 11 }}>{acceptedMechanic.phone}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 18 }}>📍</Text>
                <Text style={{ color: "#F97316", fontFamily: FONTS.bold, fontSize: 13 }}>{acceptedMechanic.dist} km</Text>
                <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 11 }}>Distance</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 18 }}>⏱</Text>
                <Text style={{ color: "#06B6D4", fontFamily: FONTS.bold, fontSize: 13 }}>{acceptedMechanic.eta}</Text>
                <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 11 }}>ETA</Text>
              </View>
            </View>
          </View>
        )}

        {/* Waiting indicator when no one accepted yet */}
        {!acceptedMechanic && (
          <View style={{
            marginTop: 20, width: "100%",
            backgroundColor: "#F9731614", borderRadius: 16,
            padding: 16, borderWidth: 1, borderColor: "#F9731630",
            alignItems: "center",
          }}>
            <ActivityIndicator color="#F97316" style={{ marginBottom: 8 }} />
            <Text style={{ color: "#F97316", fontFamily: FONTS.semibold, fontSize: 13, textAlign: "center" }}>
              Waiting for a mechanic to accept...
            </Text>
          </View>
        )}

        {!acceptedMechanic && activeJobId && (
          <Pressable
            onPress={cancelActiveRequest}
            disabled={cancelling}
            style={{
              marginTop: 14, borderRadius: 16, width: "100%",
              backgroundColor: "#EF44441A", borderWidth: 1, borderColor: "#EF444455",
              paddingVertical: 16, alignItems: "center",
            }}
          >
            <Text style={{ color: "#EF4444", fontFamily: FONTS.black, fontSize: 15 }}>
              {cancelling ? "Cancelling..." : "Cancel Request"}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.replace("/(customer)/dashboard")}
          style={{ marginTop: 20, borderRadius: 16, overflow: "hidden", width: "100%" }}
        >
          <LinearGradient colors={[ORANGE, ORANGE2]} style={{ paddingVertical: 18, alignItems: "center" }}>
            <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 17 }}>Go to Dashboard</Text>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <Pressable onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#141414", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#2A2A2A" }}>
          <Icon name="ArrowLeft" size={20} color="#AAAAAA" />
        </Pressable>
        <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 18, marginLeft: 14 }}>
          {step === 1 ? "Set Location" : step === 2 ? "Vehicle Type" : step === 3 ? "Service Needed" : "Nearby Mechanics"}
        </Text>
      </View>
      {__DEV__ && (
        <Text style={{ color: "#666666", fontFamily: FONTS.regular, fontSize: 10, paddingHorizontal: 16, paddingBottom: 4 }}>
          API {BASE_URL}
        </Text>
      )}

      <StepBar step={step} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>

        {/* ── STEP 1: Location ──────────────────────────────── */}
        {step === 1 && (
          <AnimCard>
            <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 13, marginBottom: 20, lineHeight: 20 }}>
              We need your location to find mechanics within 10km of you.
            </Text>

            {/* Live GPS button */}
            <Pressable onPress={getLiveLocation} disabled={locLoading} style={{ marginBottom: 12 }}>
              <LinearGradient
                colors={locMode === "live" ? [ORANGE, ORANGE2] : ["#141414", "#141414"]}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 20, borderRadius: 18, borderWidth: 1.5, borderColor: locMode === "live" ? ORANGE : "#2A2A2A" }}
              >
                <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: locMode === "live" ? "#ffffff20" : ORANGE + "20", alignItems: "center", justifyContent: "center" }}>
                  {locLoading ? <ActivityIndicator color={ORANGE} /> : <Icon name="Navigation" size={24} color={ORANGE} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: locMode === "live" ? "#FFFFFF" : "#FFFFFF", fontFamily: FONTS.bold, fontSize: 16 }}>Use Live GPS</Text>
                  <Text style={{ color: locMode === "live" ? "rgba(255,255,255,0.7)" : "#888888", fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>
                    {locLoading ? "Getting your location..." : "Tap to auto-detect your location"}
                  </Text>
                </View>
                {locMode === "live" && <Text style={{ color: "#FFFFFF", fontSize: 20 }}>✓</Text>}
              </LinearGradient>
            </Pressable>

            {/* Manual entry */}
            <View style={{ backgroundColor: "#141414", borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: locMode === "manual" ? ORANGE : "#2A2A2A" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <Icon name="MapPin" size={20} color={ORANGE} />
                <Text style={{ color: "#FFFFFF", fontFamily: FONTS.bold, fontSize: 15 }}>Enter Manually</Text>
              </View>
              <TextInput
                value={address}
                onChangeText={t => { setAddress(t); setLocMode("manual"); }}
                placeholder="Street address / landmark"
                placeholderTextColor="#555555"
                style={{ color: "#FFFFFF", fontFamily: FONTS.regular, fontSize: 15, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#2A2A2A", marginBottom: 10 }}
              />
              <TextInput
                value={city}
                onChangeText={t => { setCity(t); setLocMode("manual"); }}
                placeholder="City"
                placeholderTextColor="#555555"
                style={{ color: "#FFFFFF", fontFamily: FONTS.regular, fontSize: 15, backgroundColor: "#0A0A0A", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#2A2A2A" }}
              />
            </View>

            {/* Location confirmed indicator */}
            {(locMode === "live" && address) && (
              <AnimCard delay={100}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#06B6D420", borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: TEAL + "40" }}>
                  <Icon name="CheckCircle" size={18} color={TEAL} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: TEAL, fontFamily: FONTS.semibold, fontSize: 13 }}>Location Set ✓</Text>
                    <Text style={{ color: "#AAAAAA", fontFamily: FONTS.regular, fontSize: 12 }}>{address}{city ? `, ${city}` : ""}</Text>
                  </View>
                </View>
              </AnimCard>
            )}

            {/* ── Vehicle Photos (Optional) ── */}
            <AnimCard delay={200}>
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <View>
                    <Text style={{ color: "#FFFFFF", fontFamily: FONTS.bold, fontSize: 15 }}>📸 Vehicle Photos</Text>
                    <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>
                      Optional — helps mechanic prepare tools in advance
                    </Text>
                  </View>
                  <View style={{ backgroundColor: ORANGE + "20", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: ORANGE + "40" }}>
                    <Text style={{ color: ORANGE, fontFamily: FONTS.semibold, fontSize: 11 }}>OPTIONAL</Text>
                  </View>
                </View>

                {/* Photo grid */}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {vehiclePhotos.map((uri, i) => (
                    <View key={i} style={{ width: 78, height: 78, borderRadius: 12, overflow: "hidden", borderWidth: 1.5, borderColor: ORANGE + "50" }}>
                      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
                      <Pressable
                        onPress={() => setVehiclePhotos(p => p.filter((_, idx) => idx !== i))}
                        style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: "white", fontSize: 11, fontFamily: FONTS.bold }}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                  {vehiclePhotos.length < 4 && (
                    <Pressable onPress={pickVehiclePhoto} style={{ width: 78, height: 78, borderRadius: 12, backgroundColor: "#141414", borderWidth: 1.5, borderColor: "#2A2A2A", borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 }}>
                      <Icon name="Camera" size={22} color="#555555" />
                      <Text style={{ color: "#555555", fontFamily: FONTS.regular, fontSize: 9 }}>Add Photo</Text>
                    </Pressable>
                  )}
                </View>
                {vehiclePhotos.length > 0 && (
                  <Text style={{ color: TEAL, fontFamily: FONTS.regular, fontSize: 11, marginTop: 8 }}>
                    ✓ {vehiclePhotos.length} photo{vehiclePhotos.length > 1 ? "s" : ""} will be sent to the mechanic
                  </Text>
                )}
              </View>
            </AnimCard>
          </AnimCard>
        )}

        {/* ── STEP 2: Vehicle Type ──────────────────────────── */}
        {step === 2 && (
          <AnimCard>
            <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 13, marginBottom: 20 }}>
              Select the type of vehicle that needs service
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {VEHICLE_TYPES.map((v, i) => {
                const sel = vehicleType === v.id;
                return (
                  <AnimCard key={v.id} delay={i * 60} style={{ width: (width - 52) / 2 }}>
                    <Pressable
                      onPress={() => setVehicleType(v.id)}
                      style={{
                        backgroundColor: sel ? v.color + "18" : "#141414",
                        borderRadius: 18, padding: 20, alignItems: "center",
                        borderWidth: 2, borderColor: sel ? v.color : "#2A2A2A",
                      }}
                    >
                      <Text style={{ fontSize: 36, marginBottom: 10 }}>{v.emoji}</Text>
                      <Text style={{ color: sel ? v.color : "#FFFFFF", fontFamily: sel ? FONTS.bold : FONTS.medium, fontSize: 15 }}>{v.label}</Text>
                      {sel && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.color, marginTop: 8 }} />}
                    </Pressable>
                  </AnimCard>
                );
              })}
            </View>
          </AnimCard>
        )}

        {/* ── STEP 3: Service Type ──────────────────────────── */}
        {step === 3 && (
          <AnimCard>
            <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 13, marginBottom: 20 }}>
              What service do you need?
            </Text>
            <View style={{ gap: 10 }}>
              {SERVICE_TYPES.map((s, i) => {
                const sel = serviceType === s.id;
                return (
                  <AnimCard key={s.id} delay={i * 50}>
                    <Pressable
                      onPress={() => setServiceType(s.id)}
                      style={{
                        flexDirection: "row", alignItems: "center", gap: 14,
                        backgroundColor: sel ? s.color + "15" : "#141414",
                        borderRadius: 16, padding: 16,
                        borderWidth: 1.5, borderColor: sel ? s.color : "#2A2A2A",
                      }}
                    >
                      <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: s.color + "20", alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: sel ? s.color : "#FFFFFF", fontFamily: sel ? FONTS.bold : FONTS.medium, fontSize: 15 }}>{s.label}</Text>
                        <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>{s.desc}</Text>
                      </View>
                      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: sel ? s.color : "#2A2A2A", backgroundColor: sel ? s.color : "transparent", alignItems: "center", justifyContent: "center" }}>
                        {sel && <Text style={{ color: "white", fontSize: 12 }}>✓</Text>}
                      </View>
                    </Pressable>
                  </AnimCard>
                );
              })}
            </View>
            {/* Description */}
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: "#888888", fontFamily: FONTS.medium, fontSize: 13, marginBottom: 8 }}>Additional details (optional)</Text>
              <TextInput
                value={description}
                onChangeText={setDesc}
                placeholder="Describe the issue in more detail..."
                placeholderTextColor="#555555"
                multiline numberOfLines={3}
                style={{ color: "#FFFFFF", fontFamily: FONTS.regular, fontSize: 14, backgroundColor: "#141414", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#2A2A2A", minHeight: 90, textAlignVertical: "top" }}
              />
            </View>
          </AnimCard>
        )}

        {/* ── STEP 4: Nearby Mechanics ──────────────────────── */}
        {step === 4 && (
          <View>
            {searching ? (
              <SearchingRadar vehicleType={vehicleType} serviceType={serviceType} />
            ) : (
              <AnimCard>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 18 }}>
                      {mechanics.length} Mechanic{mechanics.length !== 1 ? "s" : ""} Online
                    </Text>
                    <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>
                      Within 10km · All notified · First to accept wins
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: TEAL + "20", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: TEAL + "40" }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
                    <Text style={{ color: TEAL, fontFamily: FONTS.semibold, fontSize: 11 }}>LIVE</Text>
                  </View>
                </View>

                {/* Info banner */}
                <View style={{ backgroundColor: ORANGE + "12", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: ORANGE + "30", flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                  <Text style={{ color: ORANGE, fontFamily: FONTS.medium, fontSize: 13, flex: 1, lineHeight: 19 }}>
                    All nearby mechanics have been notified. The first mechanic to accept will get this request automatically.
                  </Text>
                </View>

                {activeJobId && mechanics.length > 0 && (
                  <Pressable
                    onPress={cancelActiveRequest}
                    disabled={cancelling}
                    style={{
                      backgroundColor: "#EF44441A", borderRadius: 14, paddingVertical: 14,
                      alignItems: "center", borderWidth: 1, borderColor: "#EF444455", marginBottom: 16,
                    }}
                  >
                    <Text style={{ color: "#EF4444", fontFamily: FONTS.black, fontSize: 14 }}>
                      {cancelling ? "Cancelling..." : "Cancel Request"}
                    </Text>
                  </Pressable>
                )}

                {mechanics.map((mech, i) => (
                  <MechanicCard key={mech.id} mech={mech} delay={i * 120} />
                ))}

                {mechanics.length === 0 && (
                  <View style={{ alignItems: "center", padding: 28 }}>
                    <Text style={{ fontSize: 56, marginBottom: 16 }}>📡</Text>
                    <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 20, marginBottom: 10, textAlign: "center" }}>
                      No Mechanics Nearby
                    </Text>
                    <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 13, textAlign: "center", lineHeight: 21, marginBottom: 20 }}>
                      {"No registered mechanics are online within 10km of your location right now.\n\nYour request has been saved. Any mechanic who comes online nearby will be automatically notified."}
                    </Text>
                    <View style={{ backgroundColor: "#F9731614", borderRadius: 14, padding: 14, width: "100%", borderWidth: 1, borderColor: "#F9731630", marginBottom: 16 }}>
                      <Text style={{ color: "#F97316", fontFamily: FONTS.semibold, fontSize: 12, textAlign: "center" }}>
                        ⏳ We will notify you as soon as a mechanic accepts
                      </Text>
                    </View>
                    {activeJobId && (
                      <Pressable
                        onPress={cancelActiveRequest}
                        disabled={cancelling}
                        style={{
                          width: "100%", backgroundColor: "#EF44441A", borderRadius: 14,
                          paddingVertical: 15, alignItems: "center", borderWidth: 1,
                          borderColor: "#EF444455", marginBottom: 12,
                        }}
                      >
                        <Text style={{ color: "#EF4444", fontFamily: FONTS.black, fontSize: 15 }}>
                          {cancelling ? "Cancelling..." : "Cancel Request"}
                        </Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => router.replace("/(customer)/dashboard")} style={{ width: "100%", borderRadius: 14, overflow: "hidden" }}>
                      <LinearGradient colors={[ORANGE, ORANGE2]} style={{ paddingVertical: 16, alignItems: "center" }}>
                        <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 15 }}>Go to Dashboard</Text>
                      </LinearGradient>
                    </Pressable>
                  </View>
                )}
              </AnimCard>
            )}
          </View>
        )}

      </ScrollView>

      {/* Bottom CTA — steps 1-3 */}
      {step < 4 && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 12, backgroundColor: "#0A0A0A", borderTopWidth: 1, borderTopColor: "#1A1A1A" }}>
          <Pressable onPress={goNext} style={{ borderRadius: 18, overflow: "hidden" }}>
            <LinearGradient colors={[ORANGE, ORANGE2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
              <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 17 }}>
                {step === 3 ? "Search Mechanics" : "Continue"}
              </Text>
              <Icon name="ChevronRight" size={20} color="#FFFFFF" />
            </LinearGradient>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Success burst animation ───────────────────────────────────────
function SuccessAnimation() {
  const scale = useRef(new Animated.Value(0)).current;
  const op    = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.2, tension: 60, friction: 6, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,   tension: 60, friction: 6, useNativeDriver: true }),
    ]).start();
    Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={{ opacity: op, transform: [{ scale }], width: 120, height: 120, borderRadius: 34, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center", shadowColor: ORANGE, shadowOpacity: 0.8, shadowRadius: 30, elevation: 20 }}>
      <Text style={{ fontSize: 60 }}>⚡</Text>
    </Animated.View>
  );
}
