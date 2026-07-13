import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Animated,
  Dimensions, ScrollView, StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { FONTS, SERVICES } from "~/constants";

const { width, height } = Dimensions.get("window");

const BG      = "#0A0A0A";
const CARD    = "#141414";
const BORDER  = "#2A2A2A";
const ORANGE  = "#F97316";
const ORANGE2 = "#EA6C0A";
const BLUE    = "#2563EB";
const WHITE   = "#FFFFFF";
const GREY1   = "#AAAAAA";
const GREY2   = "#555555";

// ── Rising particle ────────────────────────────────────────────────
function Particle({ x, size, color, speed, delay }: {
  x: number; size: number; color: string; speed: number; delay: number;
}) {
  const ty = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      ty.setValue(0); op.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(ty, { toValue: -(height * 1.1), duration: speed, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 0.6, duration: speed * 0.1, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0,   duration: speed * 0.5, useNativeDriver: true }),
          ]),
        ]),
      ]).start(() => run());
    };
    run();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", bottom: 0, left: x,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: op,
      transform: [{ translateY: ty }],
    }} />
  );
}

// ── Service ticker ────────────────────────────────────────────────
const EMOJIS: Record<string, string> = {
  "tyre-puncture": "🔧", "fuel-delivery": "⛽", "engine-repair": "⚙️",
  "brake-repair": "🛑", "battery-jump-start": "⚡", "towing-services": "🚛",
  "oil-change": "🛢️", "ac-repair": "❄️",
};
function ServiceTicker() {
  const x = useRef(new Animated.Value(0)).current;
  const W = SERVICES.length * 162;
  useEffect(() => {
    Animated.loop(Animated.timing(x, { toValue: -W, duration: 24000, useNativeDriver: true })).start();
  }, []);
  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        {[...SERVICES, ...SERVICES].map((s, i) => (
          <View key={i} style={{
            flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: ORANGE + "18",
            paddingHorizontal: 14, paddingVertical: 9,
            borderRadius: 24, borderWidth: 1, borderColor: ORANGE + "35",
            marginRight: 10, width: 152,
          }}>
            <Text style={{ fontSize: 15 }}>{EMOJIS[s.type] || "🔧"}</Text>
            <Text style={{ color: ORANGE, fontFamily: FONTS.semibold, fontSize: 11.5, flex: 1 }} numberOfLines={1}>{s.label}</Text>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// ── Stat pill ──────────────────────────────────────────────────────
function StatPill({ value, label, highlight, delay }: {
  value: string; label: string; highlight?: boolean; delay: number;
}) {
  const sc = useRef(new Animated.Value(0.5)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, tension: 90, friction: 7, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={{
      opacity: op, transform: [{ scale: sc }],
      alignItems: "center", paddingHorizontal: 20, paddingVertical: 12,
      borderRadius: 14, borderWidth: 1,
      borderColor: highlight ? ORANGE + "50" : BORDER,
      backgroundColor: highlight ? ORANGE + "14" : CARD,
    }}>
      <Text style={{ color: highlight ? ORANGE : WHITE, fontFamily: FONTS.black, fontSize: 20, letterSpacing: -0.5 }}>{value}</Text>
      <Text style={{ color: GREY1, fontFamily: FONTS.regular, fontSize: 9.5, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
    </Animated.View>
  );
}

// ── Hero CTA button ────────────────────────────────────────────────
function HeroBtn({ onPress, primary, icon, title, sub, delay }: {
  onPress: () => void; primary?: boolean;
  icon: string; title: string; sub: string; delay: number;
}) {
  const sc    = useRef(new Animated.Value(0.88)).current;
  const op    = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, tension: 70, friction: 8, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: op, transform: [{ scale: sc }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.97, useNativeDriver: true, tension: 400 }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1,    useNativeDriver: true, tension: 200 }).start()}
      >
        <Animated.View style={{ transform: [{ scale: press }] }}>
          {primary ? (
            <LinearGradient
              colors={[ORANGE, ORANGE2]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.heroBtnInner}
            >
              <View style={styles.heroBtnIconWrap}><Text style={{ fontSize: 26 }}>{icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: WHITE, fontFamily: FONTS.black, fontSize: 17 }}>{title}</Text>
                <Text style={{ color: "rgba(255,255,255,0.65)", fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>{sub}</Text>
              </View>
              <View style={styles.heroBtnArrow}><Text style={{ color: WHITE, fontSize: 20, fontFamily: FONTS.bold }}>›</Text></View>
            </LinearGradient>
          ) : (
            <View style={[styles.heroBtnInner, { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }]}>
              <View style={styles.heroBtnIconWrap}><Text style={{ fontSize: 26 }}>{icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: WHITE, fontFamily: FONTS.black, fontSize: 17 }}>{title}</Text>
                <Text style={{ color: GREY1, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>{sub}</Text>
              </View>
              <View style={styles.heroBtnArrow}><Text style={{ color: GREY1, fontSize: 20, fontFamily: FONTS.bold }}>›</Text></View>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

// ── MADAT24 Logo Hero (replaces VEHICLE DOWN / RESCUE DEPLOYED) ────
function LogoHero({ op, sc }: { op: Animated.Value; sc: Animated.Value }) {
  const glowOp  = useRef(new Animated.Value(0)).current;
  const slashOp = useRef(new Animated.Value(0)).current;
  const textOp  = useRef(new Animated.Value(0)).current;
  const textY   = useRef(new Animated.Value(14)).current;
  const ringASc = useRef(new Animated.Value(0.5)).current;
  const ringAOp = useRef(new Animated.Value(0)).current;
  const ringBSc = useRef(new Animated.Value(0.3)).current;
  const ringBOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.28, duration: 1600, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.08, duration: 1600, useNativeDriver: true }),
    ])).start();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(ringAOp, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.spring(ringASc, { toValue: 1, tension: 44, friction: 8, useNativeDriver: true }),
        Animated.timing(ringBOp, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.spring(ringBSc, { toValue: 1, tension: 36, friction: 9, useNativeDriver: true }),
      ]),
      Animated.timing(slashOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(textOp, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(textY,  { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: op, transform: [{ scale: sc }], alignItems: "center", marginBottom: 28 }}>
      {/* Glow blobs */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", width: 220, height: 220, borderRadius: 110,
        backgroundColor: ORANGE, top: -50, opacity: glowOp,
      }} />
      <Animated.View pointerEvents="none" style={{
        position: "absolute", width: 180, height: 180, borderRadius: 90,
        backgroundColor: BLUE, bottom: -40, opacity: glowOp,
      }} />

      {/* Rings */}
      <Animated.View style={{
        position: "absolute", width: 260, height: 260, borderRadius: 130,
        borderWidth: 1, borderColor: BLUE + "40",
        opacity: ringBOp, transform: [{ scale: ringBSc }],
      }} />
      <Animated.View style={{
        position: "absolute", width: 200, height: 200, borderRadius: 100,
        borderWidth: 1.5, borderColor: ORANGE + "50",
        opacity: ringAOp, transform: [{ scale: ringASc }],
      }} />

      {/* Badge */}
      <View style={{
        width: 140, height: 140, borderRadius: 42,
        backgroundColor: "#0D0D0D",
        borderWidth: 2, borderColor: "#1E1E1E",
        alignItems: "center", justifyContent: "center",
        shadowColor: ORANGE, shadowOffset: { width: -4, height: 10 },
        shadowOpacity: 0.7, shadowRadius: 28, elevation: 24,
      }}>
        <View style={{ position: "absolute", top: 0, left: 0, width: "58%", height: 4, backgroundColor: ORANGE, borderTopLeftRadius: 40 }} />
        <View style={{ position: "absolute", bottom: 0, right: 0, width: "58%", height: 4, backgroundColor: BLUE, borderBottomRightRadius: 40 }} />
        <Text style={{ color: ORANGE, fontFamily: FONTS.black, fontSize: 72, lineHeight: 78, letterSpacing: -4 }}>M</Text>
        <Animated.View style={{ flexDirection: "row", gap: 4, marginTop: -6, opacity: slashOp }}>
          <View style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: ORANGE, transform: [{ skewX: "-18deg" }] }} />
          <View style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: BLUE,   transform: [{ skewX: "-18deg" }] }} />
        </Animated.View>
      </View>
      {/* Corner dots */}
      <View style={{ position: "absolute", top: -3, right: -3, width: 13, height: 13, borderRadius: 6.5, backgroundColor: BLUE }} />
      <View style={{ position: "absolute", bottom: -3, left: -3, width: 13, height: 13, borderRadius: 6.5, backgroundColor: ORANGE }} />

      {/* MADAT24/7 text — single element so "24/7" never wraps to next line */}
      <Animated.View style={{ opacity: textOp, transform: [{ translateY: textY }], flexDirection: "row", alignItems: "baseline", marginTop: 22, flexWrap: "nowrap" }}>
        <Text style={{ fontFamily: FONTS.black, fontSize: 44, letterSpacing: -2 }} numberOfLines={1}>
          <Text style={{ color: ORANGE }}>MADAT</Text><Text style={{ color: BLUE }}>24</Text><Text style={{ color: ORANGE, fontSize: 30 }}>/7</Text>
        </Text>
      </Animated.View>

      {/* Sub-tagline */}
      <Animated.View style={{ opacity: textOp, alignItems: "center", marginTop: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 30, height: 1.5, backgroundColor: ORANGE }} />
          <Text style={{ color: GREY1, fontFamily: FONTS.regular, fontSize: 11, letterSpacing: 2.5, textTransform: "uppercase" }}>
            Rapid Response
          </Text>
          <View style={{ width: 30, height: 1.5, backgroundColor: BLUE }} />
        </View>
        <Text style={{ color: GREY2, fontFamily: FONTS.regular, fontSize: 12, marginTop: 8, textAlign: "center", lineHeight: 19 }}>
          Built for India's professional{"\n"}mechanics — earn on your terms
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// ── Particles config ───────────────────────────────────────────────
const PARTICLES = [
  { x: width*0.06, size: 3, color: ORANGE, speed: 6200, delay: 0    },
  { x: width*0.22, size: 2, color: BLUE,   speed: 7800, delay: 1400 },
  { x: width*0.38, size: 3, color: ORANGE, speed: 5600, delay: 700  },
  { x: width*0.54, size: 2, color: WHITE,  speed: 8200, delay: 2600 },
  { x: width*0.68, size: 3, color: ORANGE, speed: 6600, delay: 900  },
  { x: width*0.82, size: 2, color: BLUE,   speed: 7200, delay: 3400 },
  { x: width*0.92, size: 3, color: ORANGE, speed: 5200, delay: 500  },
];

// ═══════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════
export default function Landing() {
  const heroOp  = useRef(new Animated.Value(0)).current;
  const heroY   = useRef(new Animated.Value(40)).current;
  const badgeOp = useRef(new Animated.Value(0)).current;
  const badgeSc = useRef(new Animated.Value(0.6)).current;
  const logoSc  = useRef(new Animated.Value(0.4)).current;
  const logoOp  = useRef(new Animated.Value(0)).current;
  const glowOp  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.18, duration: 2200, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.06, duration: 2200, useNativeDriver: true }),
    ])).start();

    Animated.parallel([
      Animated.spring(logoSc, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOp, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.sequence([
      Animated.delay(300),
      Animated.parallel([
        Animated.spring(badgeSc, { toValue: 1, tension: 110, friction: 8, useNativeDriver: true }),
        Animated.timing(badgeOp, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(heroOp, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(heroY,  { toValue: 0, tension: 60, friction: 9, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <View style={styles.root}>
      {/* Background glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", width: width * 1.5, height: width * 1.5,
        borderRadius: width * 0.75, backgroundColor: ORANGE,
        top: -width * 0.55, left: -width * 0.35, opacity: glowOp,
      }} />
      <Animated.View pointerEvents="none" style={{
        position: "absolute", width: width * 1.2, height: width * 1.2,
        borderRadius: width * 0.6, backgroundColor: BLUE,
        bottom: -width * 0.4, right: -width * 0.4, opacity: glowOp,
      }} />

      {/* Grid */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {[...Array(12)].map((_, i) => (
          <View key={`h${i}`} style={{ position: "absolute", top: i * (height / 12), left: 0, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.022)" }} />
        ))}
        {[...Array(7)].map((_, i) => (
          <View key={`v${i}`} style={{ position: "absolute", left: i * (width / 7), top: 0, bottom: 0, width: 1, backgroundColor: "rgba(255,255,255,0.022)" }} />
        ))}
      </View>

      {PARTICLES.map((p, i) => <Particle key={i} {...p} />)}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* ── HERO ── */}
        <View style={{ paddingTop: 60, paddingHorizontal: 24, alignItems: "center" }}>

          {/* Live badge */}
          <Animated.View style={{ opacity: badgeOp, transform: [{ scale: badgeSc }], marginBottom: 28 }}>
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30,
              backgroundColor: ORANGE + "14", borderWidth: 1, borderColor: ORANGE + "40",
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE }} />
              <Text style={{ color: ORANGE, fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 0.8 }}>
                EARN ON YOUR SCHEDULE
              </Text>
            </View>
          </Animated.View>

          {/* ── MADAT24 Logo Hero (replaces VEHICLE DOWN / RESCUE DEPLOYED) ── */}
          <LogoHero op={logoOp} sc={logoSc} />

          {/* Stats */}
          <Animated.View style={{ opacity: heroOp, flexDirection: "row", gap: 10, marginBottom: 32 }}>
            <StatPill value="50K+" label="Customers"  delay={900}  />
            <StatPill value="₹35K" label="Avg /mo"    delay={1050} />
            <StatPill value="24/7" label="Live Jobs" highlight delay={1200} />
          </Animated.View>

          {/* CTAs */}
          <View style={{ width: "100%", gap: 12 }}>
            <HeroBtn onPress={() => router.push("/(auth)/mechanic-login")} primary
              icon="🔧" title="Mechanic Login" sub="Accept jobs and earn today" delay={1000} />
            <HeroBtn onPress={() => router.push("/(auth)/mechanic-signup")}
              icon="📝" title="Join the Network" sub="Sign up — flexible work, fair pay" delay={1150} />
          </View>
        </View>

        {/* ── SERVICE TICKER ── */}
        <View style={{ marginTop: 48 }}>
          <Text style={{ color: GREY2, fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 4, textAlign: "center", marginBottom: 14, textTransform: "uppercase" }}>Our Services</Text>
          <ServiceTicker />
        </View>

        {/* ── SERVICE GRID ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 44 }}>
          <Text style={{ color: GREY2, fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>What We Fix</Text>
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { icon: "🚗", title: "CAR SYSTEMS",  desc: "Engine diagnostics, brake systems, AC repair, full overhaul", active: true },
                { icon: "🏍️", title: "BIKE SYSTEMS", desc: "Two-wheeler repairs, chain, clutch, engine tuning, electrics", active: false },
              ].map((s, i) => (
                <View key={i} style={{
                  flex: 1, padding: 18, borderRadius: 20, backgroundColor: CARD,
                  borderWidth: 1.5, borderColor: s.active ? ORANGE + "55" : BORDER,
                }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: (s.active ? ORANGE : BLUE) + "20", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Text style={{ fontSize: 24 }}>{s.icon}</Text>
                  </View>
                  <Text style={{ color: s.active ? ORANGE : WHITE, fontFamily: FONTS.black, fontSize: 13, marginBottom: 6 }}>{s.title}</Text>
                  <Text style={{ color: GREY1, fontFamily: FONTS.regular, fontSize: 11, lineHeight: 16 }}>{s.desc}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { icon: "⚡", title: "EV SOLUTIONS",   desc: "Battery & motor repair", color: BLUE   },
                { icon: "🔋", title: "POWER RECOVERY", desc: "Jump-start & alternator", color: ORANGE },
                { icon: "🔧", title: "TYRE OPS",       desc: "Puncture & alignment",   color: WHITE  },
              ].map((s, i) => (
                <View key={i} style={{ flex: 1, padding: 14, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: s.color + "18", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                    <Text style={{ fontSize: 20 }}>{s.icon}</Text>
                  </View>
                  <Text style={{ color: s.color, fontFamily: FONTS.black, fontSize: 11, marginBottom: 4 }}>{s.title}</Text>
                  <Text style={{ color: GREY2, fontFamily: FONTS.regular, fontSize: 10, lineHeight: 14 }}>{s.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── HOW IT WORKS ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 44 }}>
          <Text style={{ color: GREY2, fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 4, textTransform: "uppercase", marginBottom: 18 }}>How It Works</Text>
          {[
            { n: "01", icon: "🔔", title: "Get Job Alerts",     desc: "Customers within 10 km ping you the moment they need help.", color: ORANGE },
            { n: "02", icon: "🚗", title: "Accept & Drive",     desc: "One-tap accept. Live navigation to the customer's location.", color: BLUE   },
            { n: "03", icon: "💰", title: "Complete & Earn",    desc: "Generate the invoice in-app. Get paid on the spot.",          color: WHITE  },
          ].map((s, i) => (
            <View key={i} style={{
              flexDirection: "row", gap: 16, marginBottom: 10,
              backgroundColor: CARD, borderRadius: 20, padding: 18,
              borderWidth: 1, borderColor: i === 0 ? ORANGE + "40" : BORDER,
            }}>
              <View style={{ alignItems: "center", gap: 5 }}>
                <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: s.color + "15", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: s.color + "30" }}>
                  <Text style={{ fontSize: 24 }}>{s.icon}</Text>
                </View>
                <Text style={{ color: s.color, fontFamily: FONTS.black, fontSize: 9, letterSpacing: 1 }}>{s.n}</Text>
              </View>
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={{ color: WHITE, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 5 }}>{s.title}</Text>
                <Text style={{ color: GREY1, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 19 }}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── FINAL CTA ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 40 }}>
          <LinearGradient
            colors={[ORANGE + "22", ORANGE + "08"]}
            style={{ borderRadius: 26, padding: 28, alignItems: "center", borderWidth: 1, borderColor: ORANGE + "35" }}
          >
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: ORANGE, marginBottom: 18 }} />
            <Text style={{ color: WHITE, fontFamily: FONTS.black, fontSize: 22, textAlign: "center", letterSpacing: -0.5, marginBottom: 10 }}>
              Start earning today.
            </Text>
            <Text style={{ color: GREY1, fontFamily: FONTS.regular, fontSize: 13.5, textAlign: "center", lineHeight: 21, marginBottom: 24 }}>
              {"Join 15,000+ verified mechanics\nacross India already on Madat24"}
            </Text>
            <Pressable
              onPress={() => router.push("/(auth)/mechanic-signup")}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, width: "100%", borderRadius: 16, overflow: "hidden" })}
            >
              <LinearGradient colors={[ORANGE, ORANGE2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center" }}>
                <Text style={{ color: WHITE, fontFamily: FONTS.black, fontSize: 17 }}>🔧  Join the Network</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  heroBtnInner: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 18, paddingHorizontal: 20,
    borderRadius: 20, gap: 14,
  },
  heroBtnIconWrap: {
    width: 50, height: 50, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  heroBtnArrow: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
});
