import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, Animated, Dimensions, Pressable, StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "~/lib/icons/Icon";
import { FONTS } from "~/constants";
import { useTheme } from "~/components/ui";

const { width } = Dimensions.get("window");

// ── Pulsing ping marker ─────────────────────────────────────────
function PingMarker({ color, label, emoji }: { color: string; label: string; emoji: string }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          ]),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    pulse(ring1, 0);
    pulse(ring2, 600);
  }, []);

  return (
    <View style={{ alignItems: "center" }}>
      {/* Ripple rings */}
      {[ring1, ring2].map((r, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 60, height: 60, borderRadius: 30,
            borderWidth: 2, borderColor: color,
            opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.8] }) }],
          }}
        />
      ))}
      {/* Core marker */}
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: color, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "white", shadowColor: color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
      </View>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: color, marginTop: -1 }} />
      <View style={{ backgroundColor: color, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 }}>
        <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 10 }}>{label}</Text>
      </View>
    </View>
  );
}

// ── Road/path line between markers ──────────────────────────────
function DashedLine({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: false })
    ).start();
  }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            flex: 1, height: 3, borderRadius: 2,
            backgroundColor: color,
            marginHorizontal: 2,
            opacity: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [i % 2 === 0 ? 0.9 : 0.3, i % 2 === 0 ? 0.3 : 0.9],
            }),
          }}
        />
      ))}
    </View>
  );
}

// ── Animated car dot moving across the path ──────────────────────
function MovingCar({ color }: { color: string }) {
  const pos = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pos, { toValue: 1, duration: 3000, useNativeDriver: false }),
        Animated.timing(pos, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: "absolute",
      left: pos.interpolate({ inputRange: [0, 1], outputRange: ["0%", "78%"] }),
      bottom: 2,
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: color, alignItems: "center", justifyContent: "center",
      borderWidth: 2, borderColor: "white",
      shadowColor: color, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 6,
    }}>
      <Text style={{ fontSize: 14 }}>🚗</Text>
    </Animated.View>
  );
}

// ── ETA badge ────────────────────────────────────────────────────
function EtaBadge({ eta, color }: { eta: string; color: string }) {
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: -3, duration: 800, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <LinearGradient colors={[color + "25", color + "10"]} style={{ borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderColor: color + "40" }}>
        <Icon name="Clock" size={14} color={color} />
        <Text style={{ color, fontFamily: FONTS.bold, fontSize: 13 }}>ETA: {eta}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ════════════════════════════════════════════════════════════════
// Main TrackingMap component
// ════════════════════════════════════════════════════════════════
interface TrackingMapProps {
  customerName: string;
  mechanicName: string;
  mechanicShop?: string;
  customerCoords?: { lat: number; lng: number };
  mechanicCoords?: { lat: number; lng: number };
  distance?: number;      // km
  eta?: string;           // e.g. "12 min"
  status?: string;        // "accepted" | "in-progress" | "completed"
  viewerRole: "customer" | "mechanic";
}

export function TrackingMap({
  customerName, mechanicName, mechanicShop,
  customerCoords, mechanicCoords,
  distance = 2.4, eta = "12 min",
  status = "accepted",
  viewerRole,
}: TrackingMapProps) {
  const C = useTheme();
  const [liveEta, setLiveEta] = useState(eta);
  const [liveKm, setLiveKm] = useState(distance);
  const headerSlide = useRef(new Animated.Value(-20)).current;
  const headerFade  = useRef(new Animated.Value(0)).current;
  const mapSlide    = useRef(new Animated.Value(30)).current;
  const mapFade     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(headerFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(headerSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(mapFade,  { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(mapSlide, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();

    // Simulate live ETA countdown
    if (status === "accepted") {
      let mins = parseInt(eta);
      const interval = setInterval(() => {
        mins = Math.max(1, mins - 1);
        setLiveKm(prev => Math.max(0.1, parseFloat((prev - 0.08).toFixed(1))));
        setLiveEta(`${mins} min`);
        if (mins <= 1) clearInterval(interval);
      }, 8000);
      return () => clearInterval(interval);
    }
  }, []);

  const statusColor = status === "in-progress" ? C.yellow : status === "completed" ? C.green : "#FF8C42";
  const statusLabel = status === "accepted" ? "Mechanic on the way" : status === "in-progress" ? "Service in progress" : "Service completed";
  const statusEmoji = status === "accepted" ? "🚗" : status === "in-progress" ? "🔧" : "✅";

  const coordsText = customerCoords
    ? `${customerCoords.lat.toFixed(4)}, ${customerCoords.lng.toFixed(4)}`
    : "Locating...";

  return (
    <View style={{ backgroundColor: C.card, borderRadius: 22, overflow: "hidden", borderWidth: 1.5, borderColor: statusColor + "40", marginBottom: 16 }}>

      {/* ── Map Header ─────────────────────────────────────── */}
      <Animated.View style={{ opacity: headerFade, transform: [{ translateY: headerSlide }] }}>
        <LinearGradient colors={[statusColor + "20", "transparent"]} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 14 }}>
              {statusEmoji} {statusLabel}
            </Text>
          </View>
          <EtaBadge eta={liveEta} color={statusColor} />
        </LinearGradient>
      </Animated.View>

      {/* ── Map Canvas (simulated) ──────────────────────────── */}
      <Animated.View style={{ opacity: mapFade, transform: [{ translateY: mapSlide }] }}>
        <View style={{
          height: 200, backgroundColor: "#080C12",
          marginHorizontal: 12, marginBottom: 12,
          borderRadius: 16, overflow: "hidden",
          borderWidth: 1, borderColor: "#1C2535",
        }}>
          {/* Street grid overlay */}
          <View style={[StyleSheet.absoluteFill, { opacity: 0.08 }]}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={`h${i}`} style={{ position: "absolute", top: i * 34, left: 0, right: 0, height: 1, backgroundColor: "#00D4AA" }} />
            ))}
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={`v${i}`} style={{ position: "absolute", left: i * 64, top: 0, bottom: 0, width: 1, backgroundColor: "#00D4AA" }} />
            ))}
          </View>

          {/* Road label */}
          <View style={{ position: "absolute", top: 8, left: 12, backgroundColor: "#1C253580", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
            <Text style={{ color: "#7A8BA0", fontFamily: FONTS.regular, fontSize: 9 }}>MG Road → {customerCoords ? "Your Location" : "Destination"}</Text>
          </View>

          {/* Path */}
          <View style={{ position: "absolute", left: 36, right: 36, bottom: 58, flexDirection: "row", alignItems: "center" }}>
            <DashedLine color={statusColor} />
            {status === "accepted" && <MovingCar color={statusColor} />}
          </View>

          {/* Mechanic marker */}
          <View style={{ position: "absolute", left: 20, bottom: 40 }}>
            <PingMarker color="#FF8C42" label={mechanicName.split(" ")[0]} emoji="🔧" />
          </View>

          {/* Customer marker */}
          <View style={{ position: "absolute", right: 20, bottom: 40 }}>
            <PingMarker color="#00D4AA" label={customerName.split(" ")[0]} emoji="📍" />
          </View>

          {/* Distance pill */}
          <View style={{ position: "absolute", bottom: 10, alignSelf: "center", left: "50%", transform: [{ translateX: -40 }], backgroundColor: "#1C2535CC", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ color: "#E8EDF5", fontFamily: FONTS.bold, fontSize: 10 }}>📏 {liveKm} km away</Text>
          </View>

          {/* GPS coords badge */}
          <View style={{ position: "absolute", top: 8, right: 10, backgroundColor: "#00D4AA15", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "#00D4AA30" }}>
            <Text style={{ color: "#00D4AA", fontFamily: FONTS.regular, fontSize: 8 }}>GPS {coordsText}</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Info cards ──────────────────────────────────────── */}
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingBottom: 14 }}>
        {/* Mechanic card */}
        <View style={{ flex: 1, backgroundColor: C.bg1, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#FF8C4230" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#FF8C4220", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14 }}>🔧</Text>
            </View>
            <Text style={{ color: "#FF8C42", fontFamily: FONTS.bold, fontSize: 11 }}>MECHANIC</Text>
          </View>
          <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>{mechanicName}</Text>
          {mechanicShop && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 }}>{mechanicShop}</Text>}
          {mechanicCoords && (
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, marginTop: 4 }}>
              {mechanicCoords.lat.toFixed(4)}, {mechanicCoords.lng.toFixed(4)}
            </Text>
          )}
        </View>

        {/* Customer card */}
        <View style={{ flex: 1, backgroundColor: C.bg1, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#00D4AA30" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#00D4AA20", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14 }}>📍</Text>
            </View>
            <Text style={{ color: "#00D4AA", fontFamily: FONTS.bold, fontSize: 11 }}>
              {viewerRole === "customer" ? "YOUR LOCATION" : "CUSTOMER"}
            </Text>
          </View>
          <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>{customerName}</Text>
          {customerCoords && (
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, marginTop: 4 }}>
              {customerCoords.lat.toFixed(4)}, {customerCoords.lng.toFixed(4)}
            </Text>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#00D4AA" }} />
            <Text style={{ color: "#00D4AA", fontFamily: FONTS.regular, fontSize: 10 }}>Live GPS</Text>
          </View>
        </View>
      </View>

      {/* ── Share location button ───────────────────────────── */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 14 }}>
        <Pressable style={{ backgroundColor: C.bg1, borderRadius: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderColor: C.border }}>
          <Icon name="Share2" size={14} color={C.text3} />
          <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 12 }}>Share Live Location</Text>
        </Pressable>
      </View>
    </View>
  );
}
