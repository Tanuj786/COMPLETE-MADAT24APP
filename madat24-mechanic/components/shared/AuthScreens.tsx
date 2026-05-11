/**
 * AuthScreens.tsx — Beautiful animated Login & Signup
 * Animations: floating particles, shimmer, spring bounce,
 * stagger field entrance, success burst
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Alert,
  KeyboardAvoidingView, Platform, TextInput,
  Animated, Dimensions, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "~/lib/icons/Icon";
import { FONTS } from "~/constants";
import { useTheme } from "~/components/ui";
import { useAuthStore } from "~/stores";
import { apiSendOtp } from "~/lib/api";

// ─── Saved-credentials helpers (re-login suggestion) ─────────────
// We store email + phone + role + timestamp so the next login screen can
// pre-fill the email and show a "Continue as <email>" pill. We never
// store the password — that would defeat the security model.
type LastUser = { email: string; phone?: string; name?: string; role: "customer" | "mechanic"; savedAt: number };
const LAST_USER_KEY = "madat24_last_user";
async function saveLastUser(u: LastUser) {
  try { await AsyncStorage.setItem(LAST_USER_KEY, JSON.stringify(u)); } catch {}
}
async function getLastUser(): Promise<LastUser | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === "string") return parsed;
  } catch {}
  return null;
}
async function clearLastUser() {
  try { await AsyncStorage.removeItem(LAST_USER_KEY); } catch {}
}

const { width, height } = Dimensions.get("window");

// ─── Floating particle ────────────────────────────────────────────
function FloatParticle({ x, size, color, duration, delay }: {
  x: number; size: number; color: string; duration: number; delay: number;
}) {
  const y  = useRef(new Animated.Value(height * 0.8)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      y.setValue(height * 0.8);
      op.setValue(0);
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(y,  { toValue: -40, duration, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(op, { toValue: 0.6, duration: duration * 0.15, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0,   duration: duration * 0.6,  useNativeDriver: true }),
          ]),
        ]),
      ]).start(() => run());
    };
    run();
  }, []);
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left: x, bottom: 0,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity: op,
      transform: [{ translateY: y }],
    }} />
  );
}

// ─── Animated field ───────────────────────────────────────────────
function AnimField({ label, value, onChangeText, placeholder, keyboard = "default",
  secure = false, required = false, iconName, delay = 0, colors }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboard?: string; secure?: boolean;
  required?: boolean; iconName?: string; delay?: number;
  colors: [string, string];
}) {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  const [showPw,  setShowPw]  = useState(false);
  const translateY = useRef(new Animated.Value(30)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const scale      = useRef(new Animated.Value(0.95)).current;
  const borderAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(scale,      { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.timing(borderAnim, {
      toValue: focused ? 1 : 0, duration: 200, useNativeDriver: false,
    }).start();
  }, [focused]);

  const borderColor = borderAnim.interpolate({
    inputRange: [0, 1], outputRange: [C.border, colors[0]],
  });

  const isPassword = secure;

  return (
    <Animated.View style={{ marginBottom: 14, opacity, transform: [{ translateY }, { scale }] }}>
      <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 7 }}>
        {label}{required && <Text style={{ color: colors[0] }}> *</Text>}
      </Text>
      <Animated.View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: C.bg1, borderRadius: 14,
        borderWidth: 1.5, borderColor, paddingHorizontal: 14,
      }}>
        {iconName && (
          <View style={{ marginRight: 10 }}>
            <Icon name={iconName as any} size={18} color={focused ? colors[0] : C.text3} />
          </View>
        )}
        <TextInput
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.text3}
          keyboardType={keyboard as any}
          secureTextEntry={isPassword && !showPw}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoCapitalize={keyboard === "email-address" || keyboard === "phone-pad" ? "none" : "words"}
          style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 16 }}
        />
        {isPassword && (
          <Pressable onPress={() => setShowPw(!showPw)}>
            <Icon name={showPw ? "EyeOff" : "Eye"} size={18} color={C.text3} />
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// ─── Success burst overlay ────────────────────────────────────────
function SuccessBurst({ visible, colors }: { visible: boolean; colors: [string, string] }) {
  const scale  = useRef(new Animated.Value(0)).current;
  const opacity= useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(scale,   { toValue: 1.2, tension: 60, friction: 5, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(scale,   { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 500, delay: 400, useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={[
      StyleSheet.absoluteFill,
      { alignItems: "center", justifyContent: "center", opacity, transform: [{ scale }] },
    ]}>
      <LinearGradient colors={[colors[0] + "40", colors[1] + "20"]}
        style={{ width: 200, height: 200, borderRadius: 100, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 80 }}>✅</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ════════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ════════════════════════════════════════════════════════════════
interface LoginProps {
  roleLabel: string; icon: string; colors: [string, string];
  subtitle: string; role: "customer" | "mechanic";
  signupRoute: string; dashboardRoute: string;
}

const PARTICLES_LOGIN = [
  { x: width * 0.08, size: 4, duration: 5800, delay: 0    },
  { x: width * 0.22, size: 3, duration: 7200, delay: 1200 },
  { x: width * 0.42, size: 5, duration: 6400, delay: 600  },
  { x: width * 0.62, size: 3, duration: 8000, delay: 2400 },
  { x: width * 0.78, size: 4, duration: 5400, delay: 800  },
  { x: width * 0.92, size: 3, duration: 7600, delay: 3000 },
];

export function LoginScreen({ roleLabel, icon, colors, subtitle, role, signupRoute, dashboardRoute }: LoginProps) {
  const C = useTheme();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);
  const [lastUser, setLastUser] = useState<LastUser | null>(null);
  const { login } = useAuthStore();

  // Load any saved credentials suggestion on first paint
  useEffect(() => {
    getLastUser().then(u => {
      if (u && u.role === role) {
        setLastUser(u);
        setEmail(u.email);
      }
    });
  }, []);

  // Entrance animations
  const logoScale  = useRef(new Animated.Value(0)).current;
  const logoOp     = useRef(new Animated.Value(0)).current;
  const titleY     = useRef(new Animated.Value(40)).current;
  const titleOp    = useRef(new Animated.Value(0)).current;
  const btnScale   = useRef(new Animated.Value(0.9)).current;
  const btnOp      = useRef(new Animated.Value(0)).current;
  const glowOp     = useRef(new Animated.Value(0)).current;
  const shakeX     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.25, duration: 2000, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.08, duration: 2000, useNativeDriver: true }),
    ])).start();

    // Stagger entrance
    Animated.stagger(120, [
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOp,    { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(titleY,  { toValue: 0, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(titleOp, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(btnScale, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
        Animated.timing(btnOp,    { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    setError("");
    const emailVal = email.trim().toLowerCase();
    const passVal  = password.trim();
    if (!emailVal || !passVal) {
      setError("Please enter your email and password.");
      shakeError();
      return;
    }
    setLoading(true);
    try {
      await login(emailVal, passVal, role);
      saveLastUser({ email: emailVal, role, savedAt: Date.now() });
      setSuccess(true);
      setTimeout(() => router.replace(dashboardRoute as any), 700);
    } catch (e: any) {
      setError(e?.message || "Login failed. Please try again.");
      shakeError();
    } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Background glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", width: width * 1.4, height: width * 1.4,
        borderRadius: width * 0.7, backgroundColor: colors[0],
        top: -width * 0.5, right: -width * 0.3, opacity: glowOp,
      }} />

      {/* Particles */}
      {PARTICLES_LOGIN.map((p, i) => (
        <FloatParticle key={i} {...p} color={i % 2 === 0 ? colors[0] : colors[1]} />
      ))}

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}>

            {/* Back */}
            <Pressable onPress={() => router.back()}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 18 }}>
              <Icon name="ArrowLeft" size={20} color={C.text2} />
              <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14 }}>Back</Text>
            </Pressable>

            {/* Logo */}
            <Animated.View style={{ alignItems: "center", marginBottom: 32, marginTop: 8, opacity: logoOp, transform: [{ scale: logoScale }] }}>
              {/* Rings */}
              <View style={{ position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: colors[0] + "30", top: -20, alignSelf: "center" }} />
              <View style={{ position: "absolute", width: 170, height: 170, borderRadius: 85, borderWidth: 1,   borderColor: colors[0] + "15", top: -35, alignSelf: "center" }} />

              <LinearGradient colors={colors} style={{
                width: 100, height: 100, borderRadius: 30,
                alignItems: "center", justifyContent: "center",
                marginBottom: 20,
                shadowColor: colors[0], shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.55, shadowRadius: 28, elevation: 16,
              }}>
                <Icon name={icon as any} size={48} color="white" />
              </LinearGradient>

              <Animated.View style={{ opacity: titleOp, transform: [{ translateY: titleY }], alignItems: "center" }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 28 }}>{roleLabel} Login</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginTop: 6, textAlign: "center" }}>{subtitle}</Text>
              </Animated.View>
            </Animated.View>

            {/* Continue-as pill — pre-filled email suggestion for return users */}
            {lastUser && (
              <View style={{ marginBottom: 18 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.bold, fontSize: 9.5, letterSpacing: 1.4, marginBottom: 8 }}>
                  PICK UP WHERE YOU LEFT OFF
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: colors[0] + "10", borderWidth: 1, borderColor: colors[0] + "40" }}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: colors[0] + "20", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors[0] + "50" }}>
                    <Icon name="UserCheck" size={18} color={colors[0]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 10, letterSpacing: 0.4 }}>Continue as</Text>
                    <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13.5 }} numberOfLines={1}>{lastUser.email}</Text>
                  </View>
                  <Pressable
                    onPress={() => { clearLastUser(); setLastUser(null); setEmail(""); }}
                    hitSlop={8}
                    style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                  >
                    <Text style={{ color: C.text3, fontFamily: FONTS.semibold, fontSize: 11 }}>Use different account</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Error — shake animation */}
            {!!error && (
              <Animated.View style={{ transform: [{ translateX: shakeX }], backgroundColor: "#FF3B3015", borderRadius: 14, borderWidth: 1.5, borderColor: "#FF3B3055", padding: 14, marginBottom: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="AlertCircle" size={18} color="#FF3B30" />
                <Text style={{ color: "#FF3B30", fontFamily: FONTS.medium, fontSize: 13, flex: 1 }}>{error}</Text>
              </Animated.View>
            )}

            {/* Fields with stagger animation */}
            <View style={{ gap: 2, marginBottom: 24 }}>
              <AnimField label="Email Address" value={email} onChangeText={v => { setEmail(v); setError(""); }}
                placeholder="your@email.com" keyboard="email-address" iconName="Mail" required delay={300} colors={colors} />
              <AnimField label="Password" value={password} onChangeText={v => { setPassword(v); setError(""); }}
                placeholder="Your password" secure required iconName="Lock" delay={420} colors={colors} />

              <Animated.View style={{ opacity: btnOp, alignSelf: "flex-end" }}>
                <Pressable onPress={() => router.push("/(auth)/forgot-password" as any)}>
                  <Text style={{ color: colors[0], fontFamily: FONTS.medium, fontSize: 13 }}>Forgot Password?</Text>
                </Pressable>
              </Animated.View>
            </View>

            {/* Login Button */}
            <Animated.View style={{ opacity: btnOp, transform: [{ scale: btnScale }] }}>
              <Pressable onPress={handleLogin} disabled={loading}
                style={({ pressed }) => ({ opacity: pressed || loading ? 0.85 : 1, borderRadius: 18, overflow: "hidden" })}>
                <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 19, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                  {loading ? (
                    <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>Logging in...</Text>
                  ) : (
                    <>
                      <Icon name="LogIn" size={20} color="white" />
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>Login</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* AI Helper teaser — quick automotive help before login */}
            {role === "customer" && (
              <Animated.View style={{ opacity: btnOp, marginTop: 16 }}>
                <Pressable
                  onPress={() => router.push("/(shared)/ai-assistant" as any)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 14, borderRadius: 16,
                    backgroundColor: "#2563EB12",
                    borderWidth: 1, borderColor: "#2563EB45",
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#2563EB22", borderWidth: 1, borderColor: "#2563EB55", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 20 }}>🤖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>Stuck on the road?</Text>
                      <View style={{ backgroundColor: "#2563EB22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                        <Text style={{ color: "#2563EB", fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 0.6 }}>NO LOGIN</Text>
                      </View>
                    </View>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 1 }}>Ask our AI Mechanic — quick diagnosis & fix steps</Text>
                  </View>
                  <Icon name="ArrowRight" size={16} color="#2563EB" />
                </Pressable>
              </Animated.View>
            )}

            <Animated.View style={{ opacity: btnOp, flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 24, marginBottom: 40 }}>
              <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14 }}>Don't have an account?</Text>
              <Pressable onPress={() => router.push(signupRoute as any)}>
                <Text style={{ color: colors[0], fontFamily: FONTS.semibold, fontSize: 14 }}>Sign Up</Text>
              </Pressable>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SuccessBurst visible={success} colors={colors} />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════
// SIGNUP SCREEN
// ════════════════════════════════════════════════════════════════
interface SignupProps {
  roleLabel: string; icon: string; colors: [string, string];
  role: "customer" | "mechanic"; loginRoute: string; dashboardRoute: string;
  extraFields?: Array<{ key: string; label: string; placeholder: string; keyboard?: string }>;
}

export function SignupScreen({ roleLabel, icon, colors, role, loginRoute, dashboardRoute, extraFields = [] }: SignupProps) {
  const C = useTheme();
  const [name,        setName]        = useState("");
  const [email,       setEmail]       = useState("");
  const [phone,       setPhone]       = useState("");
  const [password,    setPassword]    = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);
  const [extras,      setExtras]      = useState<Record<string, string>>({});
  const [phase,       setPhase]       = useState<"details" | "otp">("details");
  const [emailOtp,    setEmailOtp]    = useState("");
  const [devOtp,      setDevOtp]      = useState<string | null>(null);
  const [resending,   setResending]   = useState(false);
  const { signup } = useAuthStore();

  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const headerY   = useRef(new Animated.Value(50)).current;
  const headerOp  = useRef(new Animated.Value(0)).current;
  const btnScale  = useRef(new Animated.Value(0.88)).current;
  const btnOp     = useRef(new Animated.Value(0)).current;
  const glowOp    = useRef(new Animated.Value(0)).current;
  const shakeX    = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp,    { toValue: 0.22, duration: 2400, useNativeDriver: true }),
      Animated.timing(glowOp,    { toValue: 0.06, duration: 2400, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 1600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 1600, useNativeDriver: true }),
    ])).start();

    Animated.stagger(100, [
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 55, friction: 6, useNativeDriver: true }),
        Animated.timing(logoOp,    { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(headerY,  { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
        Animated.timing(headerOp, { toValue: 1, duration: 380, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(btnScale, { toValue: 1, tension: 65, friction: 9, useNativeDriver: true }),
        Animated.timing(btnOp,    { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 10,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 7,   duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -7,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0,   duration: 55, useNativeDriver: true }),
    ]).start();
  };

  // Phase 1 — validate fields, send email OTP, switch to OTP phase
  const handleSendOtp = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Please fill in all required fields."); shakeError(); return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address."); shakeError(); return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Please enter a valid 10-digit phone number."); shakeError(); return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters."); shakeError(); return;
    }
    if (password !== confirmPass) {
      setError("Passwords do not match."); shakeError(); return;
    }
    setLoading(true);
    try {
      const r = await apiSendOtp(email.trim().toLowerCase());
      if (r.devOtp) setDevOtp(r.devOtp);  // dev mode — auto-show the code
      setPhase("otp");
      setEmailOtp("");
    } catch (e: any) {
      setError(e?.message || "Couldn't send OTP. Check your email and try again.");
      shakeError();
    } finally { setLoading(false); }
  };

  // Phase 2 — verify OTP + actually create the account
  const handleVerifyAndCreate = async () => {
    setError("");
    if (!/^\d{6}$/.test(emailOtp)) {
      setError("Enter the 6-digit code we sent to your email."); shakeError(); return;
    }
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await signup({ name: name.trim(), email: cleanEmail, phone: phone.trim(), password, emailOtp }, role);
      saveLastUser({ email: cleanEmail, phone: phone.trim(), name: name.trim(), role, savedAt: Date.now() });
      setSuccess(true);
      setTimeout(() => router.replace(dashboardRoute as any), 800);
    } catch (e: any) {
      setError(e?.message || "Signup failed. Please try again.");
      shakeError();
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    setError("");
    setResending(true);
    try {
      const r = await apiSendOtp(email.trim().toLowerCase());
      if (r.devOtp) setDevOtp(r.devOtp);
    } catch (e: any) {
      setError(e?.message || "Couldn't resend OTP.");
      shakeError();
    } finally { setResending(false); }
  };

  const fieldDelay = (i: number) => 200 + i * 90;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Background glow */}
      <Animated.View pointerEvents="none" style={{
        position: "absolute", width: width * 1.5, height: width * 1.5,
        borderRadius: width * 0.75, backgroundColor: colors[0],
        top: -width * 0.55, left: -width * 0.25, opacity: glowOp,
      }} />

      {PARTICLES_LOGIN.map((p, i) => (
        <FloatParticle key={i} {...p} color={i % 2 === 0 ? colors[0] : colors[1]} />
      ))}

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}>

            <Pressable onPress={() => router.back()}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 18 }}>
              <Icon name="ArrowLeft" size={20} color={C.text2} />
              <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14 }}>Back</Text>
            </Pressable>

            {/* Logo + title */}
            <View style={{ alignItems: "center", marginBottom: 28, marginTop: 4 }}>
              <Animated.View style={{ opacity: logoOp, transform: [{ scale: logoScale }], marginBottom: 16, alignItems: "center" }}>
                <View style={{ position: "absolute", width: 130, height: 130, borderRadius: 65, borderWidth: 1.5, borderColor: colors[0] + "28", top: -15, alignSelf: "center" }} />
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <LinearGradient colors={colors} style={{
                    width: 90, height: 90, borderRadius: 28,
                    alignItems: "center", justifyContent: "center",
                    shadowColor: colors[0], shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
                  }}>
                    <Icon name={icon as any} size={44} color="white" />
                  </LinearGradient>
                </Animated.View>
              </Animated.View>

              <Animated.View style={{ opacity: headerOp, transform: [{ translateY: headerY }], alignItems: "center" }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26 }}>Create Account</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <LinearGradient colors={colors}
                    style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 }}>
                    <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 0.5 }}>
                      {roleLabel.toUpperCase()}
                    </Text>
                  </LinearGradient>
                </View>
              </Animated.View>
            </View>

            {/* Error */}
            {!!error && (
              <Animated.View style={{ transform: [{ translateX: shakeX }], backgroundColor: "#FF3B3015", borderRadius: 14, borderWidth: 1.5, borderColor: "#FF3B3055", padding: 14, marginBottom: 18, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="AlertCircle" size={18} color="#FF3B30" />
                <Text style={{ color: "#FF3B30", fontFamily: FONTS.medium, fontSize: 13, flex: 1 }}>{error}</Text>
              </Animated.View>
            )}

            {/* Fields — only shown in details phase */}
            {phase === "details" && (
              <View style={{ gap: 2, marginBottom: 24 }}>
                <AnimField label="Full Name"     value={name}     onChangeText={v => { setName(v);    setError(""); }} placeholder="Your full name"        iconName="User"  required delay={fieldDelay(0)} colors={colors} />
                <AnimField label="Email Address" value={email}    onChangeText={v => { setEmail(v);   setError(""); }} placeholder="your@email.com"         iconName="Mail"  required keyboard="email-address" delay={fieldDelay(1)} colors={colors} />
                <AnimField label="Phone Number"  value={phone}    onChangeText={v => { setPhone(v);   setError(""); }} placeholder="+91 9876543210"          iconName="Phone" required keyboard="phone-pad"    delay={fieldDelay(2)} colors={colors} />
                {extraFields.map((f, i) => (
                  <AnimField key={f.key} label={f.label} value={extras[f.key] || ""}
                    onChangeText={v => setExtras(x => ({ ...x, [f.key]: v }))}
                    placeholder={f.placeholder} keyboard={f.keyboard} delay={fieldDelay(3 + i)} colors={colors} />
                ))}
                <AnimField label="Password"         value={password}    onChangeText={v => { setPassword(v);    setError(""); }} placeholder="Min 6 characters" iconName="Lock" required secure delay={fieldDelay(3 + extraFields.length)}     colors={colors} />
                <AnimField label="Confirm Password" value={confirmPass} onChangeText={v => { setConfirmPass(v); setError(""); }} placeholder="Re-enter password"  iconName="Lock" secure delay={fieldDelay(4 + extraFields.length)} colors={colors} />
              </View>
            )}

            {/* OTP step — verify email before account creation */}
            {phase === "otp" && (
              <View style={{ marginBottom: 24 }}>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors[0] + "18", borderWidth: 1.5, borderColor: colors[0] + "50", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Text style={{ fontSize: 30 }}>📧</Text>
                  </View>
                  <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 18 }}>Verify Your Email</Text>
                  <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4, textAlign: "center" }}>
                    We sent a 6-digit code to{"\n"}
                    <Text style={{ color: C.text1, fontFamily: FONTS.semibold }}>{email.trim().toLowerCase()}</Text>
                  </Text>
                </View>

                <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 7 }}>
                  Verification Code <Text style={{ color: colors[0] }}>*</Text>
                </Text>
                <View style={{
                  flexDirection: "row", alignItems: "center",
                  backgroundColor: C.bg1, borderRadius: 14,
                  borderWidth: 1.5, borderColor: emailOtp.length === 6 ? colors[0] : C.border,
                  paddingHorizontal: 14,
                }}>
                  <Icon name="ShieldCheck" size={18} color={emailOtp.length === 6 ? colors[0] : C.text3} />
                  <TextInput
                    value={emailOtp}
                    onChangeText={(v) => { setEmailOtp(v.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                    placeholder="000000"
                    placeholderTextColor={C.text3}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                    style={{ flex: 1, color: C.text1, fontFamily: FONTS.black, fontSize: 22, letterSpacing: 8, paddingVertical: 16, paddingHorizontal: 12, textAlign: "center" }}
                  />
                </View>

                {/* Dev-mode hint: show the actual OTP since SMTP isn't configured */}
                {devOtp && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: "#F59E0B12", borderWidth: 1, borderColor: "#F59E0B40", marginTop: 10 }}>
                    <Text style={{ fontSize: 13 }}>🔧</Text>
                    <Text style={{ flex: 1, color: "#F59E0B", fontFamily: FONTS.medium, fontSize: 11.5 }}>
                      Dev mode — your code: <Text style={{ fontFamily: FONTS.black }}>{devOtp}</Text>
                    </Text>
                  </View>
                )}

                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 14 }}>
                  <Pressable onPress={() => { setPhase("details"); setEmailOtp(""); setDevOtp(null); setError(""); }}>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13 }}>← Edit details</Text>
                  </Pressable>
                  <Pressable onPress={handleResendOtp} disabled={resending}>
                    <Text style={{ color: colors[0], fontFamily: FONTS.semibold, fontSize: 13 }}>
                      {resending ? "Sending…" : "Resend code"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Submit — adapts to current phase */}
            <Animated.View style={{ opacity: btnOp, transform: [{ scale: btnScale }] }}>
              <Pressable
                onPress={phase === "details" ? handleSendOtp : handleVerifyAndCreate}
                disabled={loading || (phase === "otp" && emailOtp.length !== 6)}
                style={({ pressed }) => ({ opacity: pressed || loading ? 0.85 : 1, borderRadius: 18, overflow: "hidden" })}
              >
                <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 19, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                  {loading ? (
                    <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>
                      {phase === "details" ? "Sending OTP..." : "Creating Account..."}
                    </Text>
                  ) : phase === "details" ? (
                    <>
                      <Icon name="Mail" size={20} color="white" />
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>Continue · Verify Email</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="UserPlus" size={20} color="white" />
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>Verify & Create Account</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>

            <Animated.View style={{ opacity: btnOp }}>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, textAlign: "center", marginTop: 12 }}>
                By creating an account, you agree to our{" "}
                <Text style={{ color: colors[0] }}>Terms & Privacy Policy</Text>
              </Text>

              {/* AI Helper teaser — try before signup */}
              {role === "customer" && phase === "details" && (
                <Pressable
                  onPress={() => router.push("/(shared)/ai-assistant" as any)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 14, borderRadius: 16, marginTop: 18,
                    backgroundColor: "#2563EB12",
                    borderWidth: 1, borderColor: "#2563EB45",
                  })}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#2563EB22", borderWidth: 1, borderColor: "#2563EB55", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 20 }}>🤖</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>Try AI Mechanic First</Text>
                      <View style={{ backgroundColor: "#2563EB22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                        <Text style={{ color: "#2563EB", fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 0.6 }}>FREE</Text>
                      </View>
                    </View>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 1 }}>Quick diagnosis without signing up</Text>
                  </View>
                  <Icon name="ArrowRight" size={16} color="#2563EB" />
                </Pressable>
              )}

              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 20, marginBottom: 50 }}>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14 }}>Already have an account?</Text>
                <Pressable onPress={() => router.push(loginRoute as any)}>
                  <Text style={{ color: colors[0], fontFamily: FONTS.semibold, fontSize: 14 }}>Login</Text>
                </Pressable>
              </View>
            </Animated.View>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SuccessBurst visible={success} colors={colors} />
    </View>
  );
}
