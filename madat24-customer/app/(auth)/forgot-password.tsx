import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, TextInput, Alert,
  Animated, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Icon from "~/lib/icons/Icon";
import { FONTS } from "~/constants";
import { useAuthStore } from "~/stores";

// Uses shared API client from lib/api.ts (IP already configured there)
import { apiSendOtp, apiVerifyOtp, apiResetPassword } from "~/lib/api";

// ── Step dot ──────────────────────────────────────────────────────
function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  const sc = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(Animated.sequence([
        Animated.timing(sc,   { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(sc,   { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])).start();
    } else {
      sc.setValue(1); glow.setValue(0);
    }
  }, [active]);
  const bg = done ? "#2ECC71" : active ? "#FF8C42" : "#1C2535";
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Animated.View style={{
        width: 13, height: 13, borderRadius: 6.5,
        backgroundColor: bg,
        transform: [{ scale: sc }],
        shadowColor: bg, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: glow.interpolate({ inputRange: [0,1], outputRange: [0, 0.8] }),
        shadowRadius: 8,
      }} />
      <Text style={{
        color: done ? "#2ECC71" : active ? "#FF8C42" : "#3A4A5C",
        fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 0.5,
      }}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ── OTP boxes ────────────────────────────────────────────────────
function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<Array<TextInput | null>>([]);
  const digits = value.padEnd(6, " ").split("");
  const anims  = Array.from({ length: 6 }, () => useRef(new Animated.Value(1)).current);

  const handleChange = (text: string, idx: number) => {
    const d = text.replace(/\D/g, "").slice(0, 1);
    const arr = digits.map((x, i) => i === idx ? d : x);
    onChange(arr.join("").replace(/ /g, ""));
    // Pop animation on fill
    if (d) {
      Animated.sequence([
        Animated.timing(anims[idx], { toValue: 1.2, duration: 80, useNativeDriver: true }),
        Animated.spring(anims[idx], { toValue: 1, tension: 200, useNativeDriver: true }),
      ]).start();
      if (idx < 5) refs.current[idx + 1]?.focus();
    }
  };
  const handleKey = (key: string, idx: number) => {
    if (key === "Backspace" && digits[idx] === " " && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  return (
    <View style={{ flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 24 }}>
      {Array.from({ length: 6 }).map((_, i) => {
        const filled = digits[i] && digits[i] !== " ";
        return (
          <Animated.View key={i} style={{ transform: [{ scale: anims[i] }] }}>
            <TextInput
              ref={r => { refs.current[i] = r; }}
              value={filled ? digits[i] : ""}
              onChangeText={t => handleChange(t, i)}
              onKeyPress={({ nativeEvent }) => handleKey(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              style={{
                width: 48, height: 60, borderRadius: 16,
                backgroundColor: filled ? "#FF8C4218" : "#0D1219",
                borderWidth: 2,
                borderColor: filled ? "#FF8C42" : "#1C2535",
                color: "#E8EDF5", fontFamily: FONTS.black,
                fontSize: 24, textAlign: "center",
              }}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
export default function ForgotPassword() {
  const [step,            setStep]          = useState<1 | 2 | 3>(1);
  const [email,           setEmail]         = useState("");
  const [otp,             setOtp]           = useState("");
  const [newPassword,     setNewPassword]   = useState("");
  const [confirmPassword, setConfirmPass]   = useState("");
  const [showPass,        setShowPass]      = useState(false);
  const [loading,         setLoading]       = useState(false);
  const [error,           setError]         = useState("");
  const [resendTimer,     setResendTimer]   = useState(0);
  const [emailSent,       setEmailSent]     = useState(false);
  const [resetToken,      setResetToken]    = useState("");
  const [generatedOtp,    setGeneratedOtp]  = useState("");

  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateStep = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 9, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { animateStep(); }, [step]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  // ── STEP 1: Send OTP email ───────────────────────────────────
  const handleSendOtp = async () => {
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const result = await apiSendOtp(trimmed);
      setEmailSent(true);
      setStep(2);
      setResendTimer(60);
      if (result.devOtp) {
        setGeneratedOtp(result.devOtp);
        Alert.alert("📧 Dev Mode OTP", `Your OTP: ${result.devOtp}\n\nAdd your Gmail to SMTP_USER in .env for real emails.`);
      } else {
        setGeneratedOtp("");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send OTP. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // ── STEP 2: Verify OTP ───────────────────────────────────────
  const handleVerifyOtp = async () => {
    setError("");
    if (otp.length < 6) { setError("Please enter all 6 digits."); return; }
    setLoading(true);
    try {
      const result = await apiVerifyOtp(email.trim().toLowerCase(), otp);
      setResetToken(result.resetToken);
      setLoading(false);
      setStep(3);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Incorrect OTP. Please check the email and try again.");
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    setOtp("");
    try {
      const result = await apiSendOtp(email.trim().toLowerCase());
      setLoading(false);
      setResendTimer(60);
      if (result.devOtp) {
        setGeneratedOtp(result.devOtp);
        Alert.alert("Dev Mode", `New OTP: ${result.devOtp}`);
      } else {
        Alert.alert("Sent!", "A new OTP has been sent to your email.");
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert("Error", err?.message || "Failed to resend OTP.");
    }
  };

  // ── STEP 3: Reset password ────────────────────────────────────
  const handleReset = async () => {
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await apiResetPassword(email.trim().toLowerCase(), resetToken, newPassword);
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || "Failed to reset password.");
      return;
    }
    setLoading(false);
    Alert.alert(
      "Password Reset! ✅",
      "Your password has been updated. Please log in with your new password.",
      [{ text: "Log In", onPress: () => router.replace("/(auth)/customer-login") }]
    );
  };

  const stepLabels = ["Email", "Verify", "Reset"];
  const stepIcons  = ["Mail", "ShieldCheck", "KeyRound"] as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#06090F" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            onPress={() => step > 1 ? setStep((step - 1) as 1 | 2 | 3) : router.back()}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 20 }}
          >
            <Icon name="ArrowLeft" size={20} color="#7A8BA0" />
            <Text style={{ color: "#7A8BA0", fontFamily: FONTS.regular, fontSize: 14 }}>Back</Text>
          </Pressable>

          <View style={{ paddingHorizontal: 26 }}>
            {/* Step indicators */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 28, marginBottom: 36 }}>
              {stepLabels.map((label, i) => (
                <React.Fragment key={i}>
                  <StepDot active={step === i + 1} done={step > i + 1} label={label} />
                  {i < 2 && (
                    <View style={{ width: 30, height: 2, backgroundColor: step > i + 1 ? "#2ECC71" : "#1C2535", alignSelf: "center", marginTop: -6, borderRadius: 1 }} />
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* Icon */}
            <View style={{ alignItems: "center", marginBottom: 24 }}>
              <LinearGradient
                colors={["#FF8C4222", "#FF8C420A"]}
                style={{ width: 80, height: 80, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FF8C4240" }}
              >
                <Icon name={stepIcons[step - 1]} size={36} color="#FF8C42" />
              </LinearGradient>
            </View>

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
              {/* Heading */}
              <Text style={{ color: "#F0F4FF", fontFamily: FONTS.black, fontSize: 28, textAlign: "center", marginBottom: 10, letterSpacing: -0.5 }}>
                {step === 1 ? "Forgot Password?" : step === 2 ? "Check Your Email" : "Set New Password"}
              </Text>
              <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 }}>
                {step === 1
                  ? "Enter your registered email and we'll send a 6-digit verification code."
                  : step === 2
                    ? `We sent a 6-digit code to\n${email}\nCheck your inbox (and spam folder).`
                    : "Create a new strong password for your account."}
              </Text>

              {/* Error banner */}
              {!!error && (
                <View style={{ backgroundColor: "#FF3B3015", borderRadius: 14, borderWidth: 1.5, borderColor: "#FF3B3040", padding: 14, marginBottom: 20, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Icon name="AlertCircle" size={18} color="#FF3B30" />
                  <Text style={{ color: "#FF3B30", fontFamily: FONTS.medium, fontSize: 13, flex: 1, lineHeight: 18 }}>{error}</Text>
                </View>
              )}

              {/* ── STEP 1 ─────────────────────────────────────── */}
              {step === 1 && (
                <View>
                  <Text style={{ color: "#7A8BA0", fontFamily: FONTS.medium, fontSize: 13, marginBottom: 8 }}>Email Address</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0D1219", borderRadius: 16, borderWidth: 1.5, borderColor: "#1C2535", paddingHorizontal: 14, marginBottom: 24 }}>
                    <Icon name="Mail" size={18} color="#3A4A5C" />
                    <TextInput
                      value={email}
                      onChangeText={v => { setEmail(v); setError(""); }}
                      placeholder="your@email.com"
                      placeholderTextColor="#3A4A5C"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      style={{ flex: 1, color: "#E8EDF5", fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 17, marginLeft: 10 }}
                    />
                  </View>
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={loading}
                    style={({ pressed }) => ({ opacity: pressed || loading ? 0.8 : 1, borderRadius: 18, overflow: "hidden" })}
                  >
                    <LinearGradient colors={["#FF9A5C", "#CC2200"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                      {loading
                        ? <ActivityIndicator color="white" size="small" />
                        : <Icon name="Send" size={18} color="white" />
                      }
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>
                        {loading ? "Sending OTP..." : "Send OTP to Email"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}

              {/* ── STEP 2 ─────────────────────────────────────── */}
              {step === 2 && (
                <View>
                  <OtpBoxes value={otp} onChange={v => { setOtp(v); setError(""); }} />
                  <Pressable
                    onPress={handleVerifyOtp}
                    disabled={loading || otp.length < 6}
                    style={({ pressed }) => ({
                      opacity: otp.length < 6 ? 0.4 : pressed || loading ? 0.8 : 1,
                      borderRadius: 18, overflow: "hidden", marginBottom: 16,
                    })}
                  >
                    <LinearGradient colors={["#FF9A5C", "#CC2200"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                      {loading
                        ? <ActivityIndicator color="white" size="small" />
                        : <Icon name="ShieldCheck" size={18} color="white" />
                      }
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>
                        {loading ? "Verifying..." : "Verify OTP"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                  {/* Resend */}
                  <Pressable onPress={handleResend} disabled={resendTimer > 0} style={{ alignItems: "center", paddingVertical: 8 }}>
                    <Text style={{ color: resendTimer > 0 ? "#3A4A5C" : "#FF8C42", fontFamily: FONTS.medium, fontSize: 13 }}>
                      {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Didn't receive it? Resend OTP"}
                    </Text>
                  </Pressable>
                  {/* Email hint */}
                  <View style={{ backgroundColor: "#3B82F610", borderRadius: 12, padding: 12, marginTop: 12, flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "#3B82F620" }}>
                    <Icon name="Info" size={14} color="#3B82F6" />
                    <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 11, flex: 1, lineHeight: 16 }}>
                      Check your spam/junk folder if you don't see it. Code expires in 10 minutes.
                    </Text>
                  </View>
                </View>
              )}

              {/* ── STEP 3 ─────────────────────────────────────── */}
              {step === 3 && (
                <View>
                  {[
                    { label: "New Password",     val: newPassword,     setVal: setNewPassword,   ph: "Min 6 characters", show: true  },
                    { label: "Confirm Password", val: confirmPassword, setVal: setConfirmPass,   ph: "Re-enter password", show: false },
                  ].map((f, i) => (
                    <View key={i} style={{ marginBottom: 14 }}>
                      <Text style={{ color: "#7A8BA0", fontFamily: FONTS.medium, fontSize: 13, marginBottom: 8 }}>{f.label}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#0D1219", borderRadius: 16, borderWidth: 1.5, borderColor: "#1C2535", paddingHorizontal: 14 }}>
                        <Icon name="Lock" size={18} color="#3A4A5C" />
                        <TextInput
                          value={f.val}
                          onChangeText={v => { f.setVal(v); setError(""); }}
                          placeholder={f.ph}
                          placeholderTextColor="#3A4A5C"
                          secureTextEntry={!showPass}
                          style={{ flex: 1, color: "#E8EDF5", fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 17, marginLeft: 10 }}
                        />
                        {f.show && (
                          <Pressable onPress={() => setShowPass(p => !p)}>
                            <Icon name={showPass ? "EyeOff" : "Eye"} size={18} color="#3A4A5C" />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  ))}
                  {/* Password strength hint */}
                  {newPassword.length > 0 && (
                    <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
                      {[
                        { label: "6+ chars",    pass: newPassword.length >= 6 },
                        { label: "Uppercase",   pass: /[A-Z]/.test(newPassword) },
                        { label: "Number",      pass: /[0-9]/.test(newPassword) },
                      ].map(h => (
                        <View key={h.label} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: h.pass ? "#2ECC7115" : "#1C2535", borderRadius: 8, padding: 6 }}>
                          <Icon name={h.pass ? "CheckCircle" : "Circle"} size={11} color={h.pass ? "#2ECC71" : "#3A4A5C"} />
                          <Text style={{ color: h.pass ? "#2ECC71" : "#3A4A5C", fontFamily: FONTS.medium, fontSize: 9 }}>{h.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <Pressable
                    onPress={handleReset}
                    disabled={loading}
                    style={({ pressed }) => ({ opacity: pressed || loading ? 0.8 : 1, borderRadius: 18, overflow: "hidden" })}
                  >
                    <LinearGradient colors={["#2ECC71", "#27AE60"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                      {loading
                        ? <ActivityIndicator color="white" size="small" />
                        : <Icon name="CheckCircle" size={20} color="white" />
                      }
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>
                        {loading ? "Resetting..." : "Reset Password"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
