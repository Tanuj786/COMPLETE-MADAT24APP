import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, Alert, Switch, Modal, TextInput, Platform, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "~/lib/icons/Icon";
import { ProgressBar, useTheme } from "~/components/ui";
import { FONTS, SERVICES, ACCENT_OPTIONS } from "~/constants";
import { useAuthStore, useMechanicStore } from "~/stores";
import { useThemeStore } from "~/stores/themeStore";
import { apiGetMechProfile, apiSaveMechProfile } from "~/lib/api";
import { showToast } from "~/components/ui/Toast";

// ─── Notification preferences (AsyncStorage-backed) ─────────────
const NOTIF_PREF_KEY = "madat24_notif_prefs";
type NotifPrefs = { push: boolean; email: boolean; sms: boolean };
const DEFAULT_NOTIF_PREFS: NotifPrefs = { push: true, email: false, sms: true };

export default function MechanicProfile() {
  const C = useTheme();
  const { user, logout } = useAuthStore();
  const { shopProfile, setShopProfile, metrics, isOnline, toggleOnline } = useMechanicStore();
  const { mode, accent, toggleMode, setAccent } = useThemeStore();

  // ── UPI ID — fetched from backend, persisted via PUT /mechanic/profile ─
  const [upiId, setUpiId] = useState<string | null>(null);
  const [upiModalOpen, setUpiModalOpen] = useState(false);
  const [upiInput, setUpiInput] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);

  // ── Notification preferences ─────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREF_KEY)
      .then(raw => { if (raw) setNotifPrefs(p => ({ ...p, ...JSON.parse(raw) })); })
      .catch(() => {});
  }, []);
  const toggleNotif = (key: keyof NotifPrefs) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    AsyncStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(next)).catch(() => {});
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Mechanic Account?",
      "This will remove your shop profile, job history, and earnings records. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => Alert.alert(
            "Almost gone",
            "Email support@madat24.in from your registered address — we'll process within 48 hours.",
            [{ text: "OK" }]
          ),
        },
      ]
    );
  };

  const APP_VERSION = "2.0.0";

  useEffect(() => {
    apiGetMechProfile()
      .then(r => {
        const id = r?.profile?.upiId ?? null;
        setUpiId(id);
        if (shopProfile && id !== shopProfile.upiId) {
          setShopProfile({ ...shopProfile, upiId: id });
        }
      })
      .catch(() => { /* offline — leave as null */ });
  }, []);

  const handleSaveUpi = async () => {
    const trimmed = upiInput.trim();
    if (trimmed && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(trimmed)) {
      Alert.alert("Invalid UPI ID", "UPI IDs look like name@bank — e.g. amit@paytm or 9876543210@ybl.");
      return;
    }
    setSavingUpi(true);
    try {
      await apiSaveMechProfile({ upiId: trimmed || null });
      setUpiId(trimmed || null);
      if (shopProfile) setShopProfile({ ...shopProfile, upiId: trimmed || null });
      showToast(trimmed ? "UPI ID saved — customers can pay you directly" : "UPI ID removed", "success");
      setUpiModalOpen(false);
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message || "Try again — make sure backend is running.");
    } finally { setSavingUpi(false); }
  };

  const handleLogout = () => Alert.alert("Sign Out", "Are you sure?", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign Out", style: "destructive", onPress: () => { logout(); router.replace("/"); } },
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Header */}
        <LinearGradient colors={[C.isDark ? "#0A0A1E" : "#EEF4FF", C.bg]} style={{ alignItems: "center", paddingTop: 32, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <LinearGradient colors={[C.primary, C.primaryDark]} style={{ width: 86, height: 86, borderRadius: 43, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Text style={{ fontSize: 40 }}>🔧</Text>
          </LinearGradient>
          <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 22 }}>{user?.name}</Text>
          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>{shopProfile?.shopName}</Text>
          <Pressable onPress={toggleOnline} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: isOnline ? C.green + "18" : C.bg1, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginTop: 10, borderWidth: 1.5, borderColor: isOnline ? C.green + "60" : C.border }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isOnline ? C.green : C.text3 }} />
            <Text style={{ color: isOnline ? C.green : C.text3, fontFamily: FONTS.semibold, fontSize: 13 }}>{isOnline ? "Online" : "Offline"} — Tap to toggle</Text>
          </Pressable>
        </LinearGradient>

        {/* KPIs */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingVertical: 20, gap: 10 }}>
          {[
            { l: "Earnings", v: `₹${metrics.totalEarnings.toLocaleString("en-IN")}`, c: C.green, e: "💰" },
            { l: "Jobs Done", v: metrics.jobsCompleted, c: C.primary, e: "✅" },
            { l: "Rating",    v: metrics.averageRating.toFixed(1), c: C.yellow, e: "⭐" },
            { l: "Reviews",   v: metrics.reviewCount, c: C.orange, e: "💬" },
          ].map((s, i) => (
            <View key={i} style={{ width: "47.5%", backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: s.c + "20" }}>
              <Text style={{ fontSize: 22, marginBottom: 6 }}>{s.e}</Text>
              <Text style={{ color: s.c, fontFamily: FONTS.black, fontSize: 20 }}>{s.v}</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </View>

        {/* Services */}
        {shopProfile?.services && shopProfile.services.length > 0 && (
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.cardBorder }}>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 14 }}>Services Offered</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {shopProfile.services.map((svcType: any) => {
                  const svc = (SERVICES as readonly any[]).find(s => s.type === svcType);
                  return svc ? (
                    <View key={svcType} style={{ backgroundColor: svc.color + "15", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: svc.color + "30" }}>
                      <Icon name={svc.icon as any} size={12} color={svc.color} />
                      <Text style={{ color: svc.color, fontFamily: FONTS.medium, fontSize: 12 }}>{svc.label}</Text>
                    </View>
                  ) : null;
                })}
              </View>
            </View>
          </View>
        )}

        {/* Payment Settings — UPI ID */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Text style={{ fontSize: 20 }}>💳</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Payment Settings</Text>
            </View>
            <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12.5, lineHeight: 18, marginBottom: 14 }}>
              Customers ke invoice par yeh UPI ID se QR generate hoga. Without this, QR uses your phone-based fallback.
            </Text>

            <Pressable
              onPress={() => { setUpiInput(upiId || ""); setUpiModalOpen(true); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1, borderColor: upiId ? C.green + "55" : C.border }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: upiId ? C.green + "20" : C.bg2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: upiId ? C.green + "40" : C.border }}>
                <Icon name="QrCode" size={18} color={upiId ? C.green : C.text3} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, letterSpacing: 0.5 }}>UPI ID</Text>
                {upiId ? (
                  <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 14 }} numberOfLines={1}>{upiId}</Text>
                ) : (
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Not set — tap to add</Text>
                )}
              </View>
              <Icon name={upiId ? "Pencil" : "Plus"} size={16} color={C.text2} />
            </Pressable>

            {!upiId && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: "#F59E0B12", borderWidth: 1, borderColor: "#F59E0B40" }}>
                <Text style={{ fontSize: 13 }}>⚠️</Text>
                <Text style={{ flex: 1, color: "#F59E0B", fontFamily: FONTS.medium, fontSize: 11.5, lineHeight: 16 }}>
                  Add your UPI ID to receive instant payments from customers.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Appearance */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <Text style={{ fontSize: 20 }}>🎨</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Appearance</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 22 }}>{mode === "dark" ? "🌙" : "☀️"}</Text>
                <View>
                  <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 14 }}>{mode === "dark" ? "Dark Mode" : "Light Mode"}</Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Toggle theme</Text>
                </View>
              </View>
              <Switch value={mode === "dark"} onValueChange={toggleMode} trackColor={{ false: C.border, true: C.primary + "60" }} thumbColor={mode === "dark" ? C.primary : C.text3} />
            </View>
            <Text style={{ color: C.text2, fontFamily: FONTS.semibold, fontSize: 13, marginBottom: 12 }}>Accent Color</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ACCENT_OPTIONS.map(opt => {
                const isActive = accent === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => setAccent(opt.key)} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: opt.hex, borderWidth: isActive ? 3 : 0, borderColor: C.text1, shadowColor: opt.hex, shadowOffset: { width: 0, height: isActive ? 4 : 0 }, shadowOpacity: isActive ? 0.5 : 0, shadowRadius: 8, elevation: isActive ? 6 : 0, alignItems: "center", justifyContent: "center" }}>
                      {isActive && <Icon name="Check" size={18} color="white" />}
                    </View>
                    <Text style={{ color: isActive ? C.text1 : C.text3, fontFamily: isActive ? FONTS.bold : FONTS.regular, fontSize: 10 }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Text style={{ fontSize: 20 }}>🔔</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Notifications</Text>
            </View>
            {[
              { key: "push" as const,  label: "Job Alerts (Push)", desc: "New requests, customer messages, payments", color: C.primary },
              { key: "email" as const, label: "Email Summaries",    desc: "Weekly earnings, monthly stats",            color: "#2563EB" },
              { key: "sms" as const,   label: "SMS Backup",         desc: "Critical job notifications",               color: C.green },
            ].map(opt => (
              <View key={opt.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: opt.key === "sms" ? 0 : 1, borderBottomColor: C.divider }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: opt.color + "18", borderWidth: 1, borderColor: opt.color + "35", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={opt.key === "push" ? "Bell" : opt.key === "email" ? "Mail" : "MessageSquare"} size={16} color={opt.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>{opt.label}</Text>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>{opt.desc}</Text>
                  </View>
                </View>
                <Switch
                  value={notifPrefs[opt.key]}
                  onValueChange={() => toggleNotif(opt.key)}
                  trackColor={{ false: C.border, true: opt.color + "60" }}
                  thumbColor={notifPrefs[opt.key] ? opt.color : C.text3}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Privacy & Security */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 20 }}>🔒</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Privacy & Security</Text>
            </View>
            <Pressable
              onPress={() => router.push("/(auth)/forgot-password" as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: "#2563EB18", borderWidth: 1, borderColor: "#2563EB35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="Key" size={16} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>Change Password</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>Reset via email OTP</Text>
              </View>
              <Icon name="ChevronRight" size={16} color={C.text3} />
            </Pressable>

            <Pressable
              onPress={() => Linking.openURL("https://madat24.in/privacy").catch(() => Alert.alert("Privacy Policy", "https://madat24.in/privacy"))}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.primary + "18", borderWidth: 1, borderColor: C.primary + "35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="ShieldCheck" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>Privacy Policy</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>How your data is used</Text>
              </View>
              <Icon name="ExternalLink" size={14} color={C.text3} />
            </Pressable>

            <Pressable
              onPress={handleDeleteAccount}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.red + "18", borderWidth: 1, borderColor: C.red + "45", alignItems: "center", justifyContent: "center" }}>
                <Icon name="Trash2" size={16} color={C.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.red, fontFamily: FONTS.semibold, fontSize: 13.5 }}>Delete Account</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>Permanently remove your shop & history</Text>
              </View>
              <Icon name="ChevronRight" size={16} color={C.red} />
            </Pressable>
          </View>
        </View>

        {/* Help & About */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Text style={{ fontSize: 20 }}>💬</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Help & About</Text>
            </View>
            <Pressable
              onPress={() => Linking.openURL("mailto:partners@madat24.in?subject=Mechanic%20Support").catch(() => Alert.alert("Contact", "partners@madat24.in"))}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.green + "18", borderWidth: 1, borderColor: C.green + "35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="LifeBuoy" size={16} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>Mechanic Partner Support</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>partners@madat24.in · 24h reply</Text>
              </View>
              <Icon name="ChevronRight" size={16} color={C.text3} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.primary + "18", borderWidth: 1, borderColor: C.primary + "35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="Info" size={16} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>App Version</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>v{APP_VERSION} · Build 2026.05</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sign out */}
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable onPress={handleLogout} style={{ backgroundColor: C.redDim, borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderColor: C.red + "40" }}>
            <Icon name="LogOut" size={20} color={C.red} />
            <Text style={{ color: C.red, fontFamily: FONTS.bold, fontSize: 15 }}>Sign Out</Text>
          </Pressable>
          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, textAlign: "center", marginTop: 16 }}>
            MADAT24/7 · Mechanic App · v{APP_VERSION}
          </Text>
        </View>

      </ScrollView>

      {/* ── UPI ID edit modal ──────────────────────────────────── */}
      <Modal visible={upiModalOpen} transparent animationType="slide" onRequestClose={() => setUpiModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: C.bg1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 }} />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.green + "20", alignItems: "center", justifyContent: "center" }}>
                <Icon name="QrCode" size={22} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 18 }}>{upiId ? "Edit UPI ID" : "Add UPI ID"}</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>Used in customer payment QR codes</Text>
              </View>
            </View>

            <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 8 }}>UPI ID</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, marginBottom: 14 }}>
              <Icon name="AtSign" size={18} color={C.text3} />
              <TextInput
                value={upiInput}
                onChangeText={(v) => setUpiInput(v.trim().toLowerCase())}
                placeholder="amit@paytm  /  9876543210@ybl"
                placeholderTextColor={C.text3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 14, marginLeft: 8 }}
              />
            </View>

            <View style={{ backgroundColor: "#2563EB10", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#2563EB30", marginBottom: 18 }}>
              <Text style={{ color: "#2563EB", fontFamily: FONTS.bold, fontSize: 11, marginBottom: 6, letterSpacing: 0.4 }}>📘 EXAMPLES</Text>
              {[
                { label: "Paytm",    sample: "9876543210@paytm" },
                { label: "PhonePe",  sample: "9876543210@ybl"   },
                { label: "GPay",     sample: "9876543210@oksbi" },
                { label: "BHIM/Bank", sample: "name@hdfcbank"   },
              ].map((s, i) => (
                <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 }}>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11.5 }}>{s.label}</Text>
                  <Text style={{ color: C.text2, fontFamily: FONTS.semibold, fontSize: 11.5 }}>{s.sample}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => setUpiModalOpen(false)}
                disabled={savingUpi}
                style={{ flex: 1, backgroundColor: C.bg, borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: C.border }}
              >
                <Text style={{ color: C.text2, fontFamily: FONTS.semibold, fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveUpi}
                disabled={savingUpi}
                style={{ flex: 1.4, borderRadius: 14, overflow: "hidden" }}
              >
                <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                  {savingUpi ? <ActivityIndicator size="small" color="white" /> : <Icon name="Save" size={16} color="white" />}
                  <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 14 }}>{savingUpi ? "Saving…" : "Save"}</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
