import React, { useEffect, useState, useRef } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  View, Text, Animated, Dimensions, StyleSheet,
} from "react-native";
import {
  useFonts,
  Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold,
  Outfit_700Bold, Outfit_900Black,
} from "@expo-google-fonts/outfit";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans";
import * as SplashScreen from "expo-splash-screen";
import { useThemeStore } from "~/stores/themeStore";
import { LinearGradient } from "expo-linear-gradient";
import { ToastHost } from "~/components/ui/Toast";

SplashScreen.preventAutoHideAsync();
export { ErrorBoundary } from "expo-router";

const { width, height } = Dimensions.get("window");

// ─── Scene cards shown during the splash animation ────────────────
// Each card slides in to tell the story "mechanic helping a customer"
const SCENES = [
  { emoji: "🚗",  title: "Vehicle Down?",       sub: "We detect your situation instantly",  color: "#F97316" },
  { emoji: "📍",  title: "Location Shared",     sub: "GPS locks on your position",          color: "#2563EB" },
  { emoji: "🔧",  title: "Mechanic Dispatched", sub: "Nearest verified tech on the way",    color: "#22C55E" },
  { emoji: "⚡",  title: "Problem Solved",      sub: "Back on the road in minutes",         color: "#F97316" },
];

// ─── Single scene card ────────────────────────────────────────────
function SceneCard({ emoji, title, sub, color, visible }: {
  emoji: string; title: string; sub: string; color: string; visible: boolean;
}) {
  const op = useRef(new Animated.Value(0)).current;
  const x  = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(x,  { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(op, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(x,  { toValue: -40, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={{
      position: "absolute",
      bottom: 110, left: 24, right: 24,
      opacity: op,
      transform: [{ translateX: x }],
    }}>
      <View style={{
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 20,
        borderWidth: 1,
        borderColor: color + "40",
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}>
        <View style={{
          width: 54, height: 54, borderRadius: 16,
          backgroundColor: color + "20",
          alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: color + "40",
        }}>
          <Text style={{ fontSize: 28 }}>{emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            color: "#FFFFFF", fontFamily: "Outfit_900Black",
            fontSize: 16, marginBottom: 4,
          }}>{title}</Text>
          <Text style={{
            color: "rgba(255,255,255,0.55)", fontFamily: "Outfit_400Regular",
            fontSize: 12, lineHeight: 17,
          }}>{sub}</Text>
        </View>
        <View style={{
          width: 8, height: 8, borderRadius: 4,
          backgroundColor: color,
          shadowColor: color, shadowOpacity: 1, shadowRadius: 6,
        }} />
      </View>
    </Animated.View>
  );
}

// ─── Mechanic Repair Animation ────────────────────────────────────
// A rotating gear with the M letter inside, plus a swinging wrench
// and sparks at the contact point — pure View primitives, no SVG.
function MechanicAnimation({ visible }: { visible: Animated.Value }) {
  const gearRot   = useRef(new Animated.Value(0)).current;
  const wrenchRot = useRef(new Animated.Value(0)).current;
  const sparkOp   = useRef(new Animated.Value(0)).current;
  const sparkScl  = useRef(new Animated.Value(0)).current;
  const sparkOp2  = useRef(new Animated.Value(0)).current;
  const sparkScl2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(gearRot, { toValue: 1, duration: 3500, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(wrenchRot, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(wrenchRot, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(160),
      ])
    ).start();

    const fire = (op: Animated.Value, sc: Animated.Value, delay: number, dur: number) => {
      op.setValue(1); sc.setValue(0.3);
      Animated.parallel([
        Animated.timing(op, { toValue: 0,   duration: dur, useNativeDriver: true, delay }),
        Animated.timing(sc, { toValue: 1.6, duration: dur, useNativeDriver: true, delay }),
      ]).start();
    };
    const tick = () => { fire(sparkOp, sparkScl, 0, 460); fire(sparkOp2, sparkScl2, 90, 540); };
    tick();
    const id = setInterval(tick, 740);
    return () => clearInterval(id);
  }, []);

  const gearSpin    = gearRot.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const wrenchSwing = wrenchRot.interpolate({ inputRange: [0, 1], outputRange: ["-26deg", "6deg"] });

  return (
    <Animated.View pointerEvents="none" style={{
      opacity: visible, position: "absolute",
      width: 240, height: 200,
      alignItems: "center", justifyContent: "center",
    }}>
      {/* Gear — rotating, with M in core */}
      <Animated.View style={{ transform: [{ rotate: gearSpin }] }}>
        <View style={{
          width: 130, height: 130, borderRadius: 65,
          backgroundColor: "#0E0E0E",
          borderWidth: 3, borderColor: "#F97316",
          alignItems: "center", justifyContent: "center",
          shadowColor: "#F97316", shadowOpacity: 0.7, shadowRadius: 20, shadowOffset: { width: 0, height: 0 }, elevation: 18,
        }}>
          {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
            <View key={deg} style={{
              position: "absolute",
              width: 16, height: 20,
              backgroundColor: "#F97316",
              borderTopLeftRadius: 3, borderTopRightRadius: 3,
              transform: [{ rotate: `${deg}deg` }, { translateY: -67 }],
            }} />
          ))}
          {/* Inner hub */}
          <View style={{
            width: 78, height: 78, borderRadius: 39,
            backgroundColor: "#080808",
            borderWidth: 1.5, borderColor: "#1E1E1E",
            alignItems: "center", justifyContent: "center",
          }}>
            {[0, 60, 120].map(deg => (
              <View key={deg} pointerEvents="none" style={{
                position: "absolute",
                width: 2, height: 56,
                backgroundColor: "#1F1F1F",
                borderRadius: 1,
                transform: [{ rotate: `${deg}deg` }],
              }} />
            ))}
            <Text style={{
              color: "#F97316", fontFamily: "Outfit_900Black",
              fontSize: 36, lineHeight: 40, letterSpacing: -2,
            }}>M</Text>
          </View>
        </View>
      </Animated.View>

      {/* Wrench — top-right, pivoting at its head */}
      <Animated.View style={{
        position: "absolute",
        top: 12, right: -2,
        transform: [
          { translateX: 26 },
          { rotate: wrenchSwing },
          { translateX: -26 },
        ],
      }}>
        <View style={{ width: 64, height: 11, backgroundColor: "#2563EB", borderRadius: 5.5 }} />
        <View style={{
          position: "absolute", left: -8, top: -5,
          width: 22, height: 21,
          backgroundColor: "#2563EB",
          borderRadius: 4,
          alignItems: "center", justifyContent: "center",
        }}>
          <View style={{ width: 12, height: 13, backgroundColor: "#080808", borderRadius: 2 }} />
        </View>
        <View style={{
          position: "absolute", right: -3, top: 1,
          width: 9, height: 9, borderRadius: 4.5,
          backgroundColor: "#1E40AF",
          borderWidth: 1, borderColor: "#3B82F6",
        }} />
      </Animated.View>

      {/* Sparks at impact point */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: 36, right: 78,
        opacity: sparkOp, transform: [{ scale: sparkScl }],
      }}>
        <Text style={{ fontSize: 22 }}>✨</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={{
        position: "absolute", top: 52, right: 72,
        opacity: sparkOp2, transform: [{ scale: sparkScl2 }],
      }}>
        <Text style={{ fontSize: 14 }}>⚡</Text>
      </Animated.View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════
// SPLASH SCREEN — Full screen with mechanic story animation
// ═══════════════════════════════════════════════════════════
function Madat24Splash({ onDone }: { onDone: () => void }) {
  // animated values
  const screenOp  = useRef(new Animated.Value(1)).current;
  const logoSc    = useRef(new Animated.Value(0.4)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const mechOp    = useRef(new Animated.Value(0)).current;  // mechanic animation reveal
  const titleOp   = useRef(new Animated.Value(0)).current;
  const titleY    = useRef(new Animated.Value(20)).current;
  const tagOp     = useRef(new Animated.Value(0)).current;
  const ring1Sc   = useRef(new Animated.Value(0.4)).current;
  const ring1Op   = useRef(new Animated.Value(0)).current;
  const ring2Sc   = useRef(new Animated.Value(0.3)).current;
  const ring2Op   = useRef(new Animated.Value(0)).current;
  const glowAOp   = useRef(new Animated.Value(0)).current;
  const glowBOp   = useRef(new Animated.Value(0)).current;
  const progressW = useRef(new Animated.Value(0)).current;  // progress bar
  const slashOp   = useRef(new Animated.Value(0)).current;

  // which scene card is showing (-1 = none)
  const [sceneIdx, setSceneIdx] = useState(-1);

  useEffect(() => {
    // Ambient glow pulses
    Animated.loop(Animated.sequence([
      Animated.timing(glowAOp, { toValue: 0.25, duration: 1400, useNativeDriver: true }),
      Animated.timing(glowAOp, { toValue: 0.06, duration: 1400, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.delay(700),
      Animated.timing(glowBOp, { toValue: 0.20, duration: 1400, useNativeDriver: true }),
      Animated.timing(glowBOp, { toValue: 0.04, duration: 1400, useNativeDriver: true }),
    ])).start();

    // Main sequence
    Animated.sequence([
      // 0 — mechanic gear+wrench reveal + rings expand
      Animated.parallel([
        Animated.timing(mechOp,  { toValue: 1,    duration: 320, useNativeDriver: true }),
        Animated.timing(ring1Op, { toValue: 0.55, duration: 420, useNativeDriver: true }),
        Animated.spring(ring1Sc, { toValue: 1, tension: 45, friction: 8, useNativeDriver: true }),
        Animated.timing(ring2Op, { toValue: 0.28, duration: 550, useNativeDriver: true }),
        Animated.spring(ring2Sc, { toValue: 1, tension: 36, friction: 9, useNativeDriver: true }),
      ]),
      // Linger on the gear+wrench so the user sees it working
      Animated.delay(1200),
      // 1 — mech fades, logo badge pops in its place
      Animated.parallel([
        Animated.timing(mechOp,  { toValue: 0, duration: 320, useNativeDriver: true }),
        Animated.spring(logoSc,  { toValue: 1, tension: 70, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOp,  { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.timing(slashOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(120),
      // 2 — text
      Animated.parallel([
        Animated.timing(titleOp, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(titleY,  { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
        Animated.timing(tagOp,   { toValue: 1, duration: 420, useNativeDriver: true }),
      ]),
      Animated.delay(220),
      // 3 — progress bar drives the scene cards
      Animated.timing(progressW, { toValue: width - 48, duration: 3000, useNativeDriver: false }),
    ]).start();

    // Cycle through scene cards (delays measured from splash start, after gear reveal)
    const delays = [2200, 3000, 3800, 4600];
    delays.forEach((d, i) => {
      setTimeout(() => setSceneIdx(i), d);
    });

    // Fade out after the last scene has been seen
    setTimeout(() => {
      Animated.timing(screenOp, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => onDone());
    }, 5600);
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: screenOp, zIndex: 9999 }]}>
      {/* Dark background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "#080808" }]} />

      {/* Diagonal stripe texture */}
      {[...Array(8)].map((_, i) => (
        <View key={i} pointerEvents="none" style={{
          position: "absolute",
          width: width * 2,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.015)",
          top: i * (height / 7),
          left: -width * 0.3,
          transform: [{ rotate: "-18deg" }],
        }} />
      ))}

      {/* Orange glow — top-left */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute",
        width: width * 1.6, height: width * 1.6,
        borderRadius: width * 0.8,
        backgroundColor: "#F97316",
        left: -width * 0.5, top: -width * 0.5,
        opacity: glowAOp,
      }} />
      {/* Blue glow — bottom-right */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute",
        width: width * 1.4, height: width * 1.4,
        borderRadius: width * 0.7,
        backgroundColor: "#2563EB",
        right: -width * 0.5, bottom: -width * 0.3,
        opacity: glowBOp,
      }} />

      {/* Grid dots */}
      {[...Array(6)].map((_, row) =>
        [...Array(4)].map((_, col) => (
          <View key={`${row}-${col}`} pointerEvents="none" style={{
            position: "absolute",
            width: 2, height: 2, borderRadius: 1,
            backgroundColor: "rgba(255,255,255,0.06)",
            top: row * (height / 5) + 40,
            left: col * (width / 3) + 30,
          }} />
        ))
      )}

      {/* ── Center content ── */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>

        {/* Outer ring — blue */}
        <Animated.View style={{
          position: "absolute",
          width: 280, height: 280, borderRadius: 140,
          borderWidth: 1, borderColor: "#2563EB",
          opacity: ring2Op, transform: [{ scale: ring2Sc }],
        }} />
        {/* Inner ring — orange */}
        <Animated.View style={{
          position: "absolute",
          width: 210, height: 210, borderRadius: 105,
          borderWidth: 1.5, borderColor: "#F97316",
          opacity: ring1Op, transform: [{ scale: ring1Sc }],
        }} />

        {/* Mechanic gear+wrench animation — shown first, then fades to reveal logo */}
        <View style={{ marginBottom: 36, alignItems: "center", justifyContent: "center", width: 240, height: 200 }}>
          <MechanicAnimation visible={mechOp} />

        {/* Logo badge — fades in after the gear animation, centered in the same stage */}
        <Animated.View style={{
          opacity: logoOp,
          transform: [{ scale: logoSc }],
          alignItems: "center", justifyContent: "center",
        }}>
          <View style={{
            width: 136, height: 136, borderRadius: 40,
            backgroundColor: "#0D0D0D",
            borderWidth: 2, borderColor: "#222222",
            alignItems: "center", justifyContent: "center",
            shadowColor: "#F97316",
            shadowOffset: { width: -4, height: 10 },
            shadowOpacity: 0.7, shadowRadius: 28, elevation: 24,
          }}>
            {/* Orange bar — top-left */}
            <View style={{
              position: "absolute", top: 0, left: 0,
              width: "58%", height: 4,
              backgroundColor: "#F97316",
              borderTopLeftRadius: 38,
            }} />
            {/* Blue bar — bottom-right */}
            <View style={{
              position: "absolute", bottom: 0, right: 0,
              width: "58%", height: 4,
              backgroundColor: "#2563EB",
              borderBottomRightRadius: 38,
            }} />

            {/* M letter */}
            <Text style={{
              color: "#F97316",
              fontFamily: "Outfit_900Black",
              fontSize: 68,
              lineHeight: 74,
              letterSpacing: -4,
            }}>M</Text>

            {/* Slash lines */}
            <Animated.View style={{
              flexDirection: "row", gap: 4,
              opacity: slashOp, marginTop: -6,
            }}>
              <View style={{
                width: 30, height: 3, borderRadius: 2,
                backgroundColor: "#F97316",
                transform: [{ skewX: "-18deg" }],
              }} />
              <View style={{
                width: 20, height: 3, borderRadius: 2,
                backgroundColor: "#2563EB",
                transform: [{ skewX: "-18deg" }],
              }} />
            </Animated.View>
          </View>

          {/* Corner accent dots */}
          <View style={{
            position: "absolute", top: -5, right: -5,
            width: 13, height: 13, borderRadius: 6.5,
            backgroundColor: "#2563EB",
            shadowColor: "#2563EB", shadowOpacity: 1, shadowRadius: 5,
          }} />
          <View style={{
            position: "absolute", bottom: -5, left: -5,
            width: 13, height: 13, borderRadius: 6.5,
            backgroundColor: "#F97316",
            shadowColor: "#F97316", shadowOpacity: 1, shadowRadius: 5,
          }} />
        </Animated.View>
        </View>

        {/* MADAT24/7 — single Text so "24/7" never wraps on any screen size */}
        <Animated.View style={{
          opacity: titleOp,
          transform: [{ translateY: titleY }],
          flexDirection: "row", alignItems: "baseline",
          marginBottom: 12, flexWrap: "nowrap",
        }}>
          <Text style={{ fontFamily: "Outfit_900Black", fontSize: 42, letterSpacing: -2 }} numberOfLines={1}>
            <Text style={{ color: "#F97316" }}>MADAT</Text><Text style={{ color: "#2563EB" }}>24</Text><Text style={{ color: "#F97316", fontSize: 28 }}>/7</Text>
          </Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={{ opacity: tagOp, alignItems: "center", marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 32, height: 1.5, backgroundColor: "#F97316" }} />
            <Text style={{
              color: "#888888", fontFamily: "Outfit_400Regular",
              fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
            }}>24 Hours · 7 Days</Text>
            <View style={{ width: 32, height: 1.5, backgroundColor: "#2563EB" }} />
          </View>
          <Text style={{
            color: "#444444", fontFamily: "Outfit_400Regular",
            fontSize: 10, marginTop: 7, letterSpacing: 0.5,
          }}>
            Rapid Roadside Rescue · Anywhere · Anytime
          </Text>
        </Animated.View>
      </View>

      {/* ── Scene cards (mechanic story) ── */}
      {SCENES.map((scene, i) => (
        <SceneCard key={i} {...scene} visible={sceneIdx === i} />
      ))}

      {/* ── Progress bar ── */}
      <View style={{ position: "absolute", bottom: 54, left: 24, right: 24 }}>
        <View style={{
          height: 2, backgroundColor: "rgba(255,255,255,0.08)",
          borderRadius: 1, overflow: "hidden",
        }}>
          <Animated.View style={{
            height: "100%", borderRadius: 1,
            width: progressW,
            backgroundColor: "#F97316",
          }} />
        </View>

        {/* Dot indicators */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
          {SCENES.map((_, i) => (
            <View key={i} style={{
              width: sceneIdx === i ? 18 : 6,
              height: 6, borderRadius: 3,
              backgroundColor: sceneIdx === i ? "#F97316" : "rgba(255,255,255,0.15)",
            }} />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

// ════════════════════════════════════════════════════════════════
export default function RootLayout() {
  const { colors, mode } = useThemeStore();
  const [showSplash, setShowSplash] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_900Black,
    DMSans_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: "fade",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(customer)" />
          <Stack.Screen name="(shared)" />
        </Stack>

        <ToastHost />

        {showSplash && (
          <Madat24Splash onDone={async () => {
            setShowSplash(false);
            try {
              const { router } = await import("expo-router");
              const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
              const raw = await AsyncStorage.getItem("madat24_user");
              if (raw) {
                const user = JSON.parse(raw);
                if (user.role === "customer") {
                  const { useAuthStore } = await import("~/stores");
                  useAuthStore.setState({ user, isLoggedIn: true });
                  // Re-register push on session restore
                  import("~/lib/push").then(p => p.registerPushOnLogin().catch(() => {}));
                  router.replace("/(customer)/dashboard");
                } else {
                  // Wrong app for this account — clear session and stay on landing
                  await AsyncStorage.removeItem("madat24_user");
                  await AsyncStorage.removeItem("madat24_token");
                }
              }
            } catch {
              // No saved session — stay on landing page
            }
          }} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
