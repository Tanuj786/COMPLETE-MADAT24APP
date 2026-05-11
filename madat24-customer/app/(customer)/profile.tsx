/**
 * Customer Profile — Enhanced
 * - Profile photo (camera + gallery)
 * - Car number, make, model, year, color
 * - Vehicle photo upload
 * - Appearance settings
 * - Account settings
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Alert, Switch,
  TextInput, Image, Animated, Dimensions, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "~/lib/icons/Icon";
import { useTheme } from "~/components/ui";
import { FONTS, ACCENT_OPTIONS } from "~/constants";
import { useAuthStore, useCustomerStore } from "~/stores";
import { useThemeStore } from "~/stores/themeStore";

// ─── Notification preferences (AsyncStorage-backed) ─────────────
const NOTIF_PREF_KEY = "madat24_notif_prefs";
type NotifPrefs = { push: boolean; email: boolean; sms: boolean };
const DEFAULT_NOTIF_PREFS: NotifPrefs = { push: true, email: true, sms: true };
async function loadNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_PREF_KEY);
    if (raw) return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_NOTIF_PREFS;
}
async function saveNotifPrefs(p: NotifPrefs) {
  try { await AsyncStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(p)); } catch {}
}

const { width } = Dimensions.get("window");

const ORANGE = "#F97316";
const BLUE   = "#2563EB";

// ─── Editable field ───────────────────────────────────────────────
function EditField({ label, value, onChangeText, placeholder, keyboard = "default", icon }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboard?: string; icon?: string;
}) {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: focused ? ORANGE : C.border, paddingHorizontal: 14, paddingVertical: 2 }}>
        {icon && <Icon name={icon as any} size={16} color={focused ? ORANGE : C.text3} style={{ marginRight: 10 }} />}
        <TextInput
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.text3}
          keyboardType={keyboard as any}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 13 }}
        />
      </View>
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────────
function SectionCard({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  const C = useTheme();
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export default function CustomerProfile() {
  const C = useTheme();
  const { user, logout } = useAuthStore();
  const { jobs } = useCustomerStore();
  const { mode, accent, toggleMode, setAccent } = useThemeStore();

  // Profile photo
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  // Editable personal info
  const [name,  setName]  = useState(user?.name  || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");

  // Vehicle / car details
  const [carNumber, setCarNumber] = useState("");
  const [carMake,   setCarMake]   = useState(""); // e.g. Maruti
  const [carModel,  setCarModel]  = useState(""); // e.g. Swift
  const [carYear,   setCarYear]   = useState(""); // e.g. 2020
  const [carColor,  setCarColor]  = useState(""); // e.g. White
  const [carPhotos, setCarPhotos] = useState<string[]>([]);

  const [editing, setEditing] = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Notification preferences
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  useEffect(() => { loadNotifPrefs().then(setNotifPrefs); }, []);
  const toggleNotif = (key: keyof NotifPrefs) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    saveNotifPrefs(next);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account?",
      "This will permanently remove your account, jobs, and chat history. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Almost gone",
              "Account deletion is currently a manual process. Email support@madat24.com from your registered address — we'll process within 48 hours.",
              [{ text: "OK" }]
            );
          },
        },
      ]
    );
  };

  const APP_VERSION = "2.0.0";

  const completed  = jobs.filter(j => j.status === "completed").length;
  const totalSpent = jobs.reduce((s, j) => s + (j.invoice?.total || 0), 0);

  const pickProfilePhoto = async () => {
    Alert.alert("Profile Photo", "Choose source", [
      {
        text: "📷 Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow camera in settings"); return; }
          const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!res.canceled && res.assets[0]) setProfilePhoto(res.assets[0].uri);
        },
      },
      {
        text: "🖼️ Gallery",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow gallery in settings"); return; }
          const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
          if (!res.canceled && res.assets[0]) setProfilePhoto(res.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const pickCarPhoto = async () => {
    if (carPhotos.length >= 4) { Alert.alert("Max 4 photos allowed"); return; }
    Alert.alert("Add Vehicle Photo", "Choose source", [
      {
        text: "📷 Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return;
          const res = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.75 });
          if (!res.canceled && res.assets[0]) setCarPhotos(p => [...p, res.assets[0].uri]);
        },
      },
      {
        text: "🖼️ Gallery",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") return;
          const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.75, mediaTypes: ImagePicker.MediaTypeOptions.Images });
          if (!res.canceled && res.assets[0]) setCarPhotos(p => [...p, res.assets[0].uri]);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSave = () => {
    setSaved(true);
    setEditing(false);
    Alert.alert("✅ Profile Saved", "Your changes have been updated.");
    setTimeout(() => setSaved(false), 3000);
  };

  const handleLogout = () => Alert.alert("Sign Out", "Are you sure you want to sign out?", [
    { text: "Cancel", style: "cancel" },
    { text: "Sign Out", style: "destructive", onPress: () => { logout(); router.replace("/"); } },
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

        {/* ── Header with MADAT24 logo + profile ── */}
        <LinearGradient
          colors={["#0A0A0A", "#111111"]}
          style={{ paddingTop: 16, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: "#1E1E1E" }}
        >
          {/* Top bar */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "#0F0F0F", borderWidth: 1.5, borderColor: "#1E1E1E", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: ORANGE, fontFamily: FONTS.black, fontSize: 18, letterSpacing: -1 }}>M</Text>
                <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: BLUE }} />
              </View>
              <View style={{ flexDirection: "row", alignItems: "baseline" }}>
                <Text style={{ color: ORANGE, fontFamily: FONTS.black, fontSize: 16, letterSpacing: -0.5 }}>MADAT</Text>
                <Text style={{ color: BLUE, fontFamily: FONTS.black, fontSize: 16, letterSpacing: -0.5 }}>24</Text>
                <Text style={{ color: ORANGE, fontFamily: FONTS.black, fontSize: 11, letterSpacing: -0.5 }}>/7</Text>
              </View>
            </View>
            <Pressable onPress={() => setEditing(!editing)} style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: editing ? ORANGE + "20" : "#1A1A1A", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: editing ? ORANGE + "50" : "#2A2A2A" }}>
              <Icon name={editing ? "X" : "Edit3"} size={14} color={editing ? ORANGE : "#888888"} />
              <Text style={{ color: editing ? ORANGE : "#888888", fontFamily: FONTS.semibold, fontSize: 13 }}>{editing ? "Cancel" : "Edit"}</Text>
            </Pressable>
          </View>

          {/* Profile photo + name */}
          <View style={{ alignItems: "center" }}>
            <Pressable onPress={pickProfilePhoto} style={{ marginBottom: 14 }}>
              <View style={{ width: 96, height: 96, borderRadius: 28, overflow: "hidden", borderWidth: 2.5, borderColor: ORANGE + "60", shadowColor: ORANGE, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10 }}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <LinearGradient colors={[ORANGE, "#EA6C0A"]} style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 36 }}>
                      {(user?.name || "U")[0].toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              {/* Camera badge */}
              <View style={{ position: "absolute", bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: BLUE, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#0A0A0A" }}>
                <Icon name="Camera" size={13} color="white" />
              </View>
            </Pressable>

            <Text style={{ color: "#FFFFFF", fontFamily: FONTS.black, fontSize: 22, marginBottom: 4 }}>{user?.name || "Customer"}</Text>
            <Text style={{ color: "#888888", fontFamily: FONTS.regular, fontSize: 13, marginBottom: 10 }}>{user?.email || user?.phone || ""}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: ORANGE + "18", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: ORANGE + "40" }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: ORANGE }} />
              <Text style={{ color: ORANGE, fontFamily: FONTS.semibold, fontSize: 12 }}>Customer Account</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats */}
        <Animated.View style={{ opacity: fadeAnim, flexDirection: "row", paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}>
          {[
            { l: "Total Jobs", v: jobs.length,      c: ORANGE, e: "📋" },
            { l: "Completed",  v: completed,         c: "#22C55E", e: "✅" },
            { l: "Total Spent", v: `₹${Math.round(totalSpent)}`, c: BLUE, e: "💰" },
          ].map((s, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: C.card, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, borderColor: s.c + "22" }}>
              <Text style={{ fontSize: 22, marginBottom: 5 }}>{s.e}</Text>
              <Text style={{ color: s.c, fontFamily: FONTS.black, fontSize: 18 }}>{s.v}</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 10, textAlign: "center", marginTop: 2 }}>{s.l}</Text>
            </View>
          ))}
        </Animated.View>

        <View style={{ paddingHorizontal: 16 }}>

          {/* ── Personal Info ── */}
          <SectionCard title="Personal Info" emoji="👤">
            <EditField label="Full Name" value={name} onChangeText={setName} placeholder="Your name" icon="User" />
            <EditField label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com" keyboard="email-address" icon="Mail" />
            <EditField label="Phone" value={phone} onChangeText={setPhone} placeholder="+91 XXXXXXXXXX" keyboard="phone-pad" icon="Phone" />
          </SectionCard>

          {/* ── Vehicle / Car Details ── */}
          <SectionCard title="Vehicle Details" emoji="🚗">
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginBottom: 14, lineHeight: 18 }}>
              Adding your vehicle details helps mechanics prepare the right tools before arriving.
            </Text>

            {/* Car number plate */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 8 }}>Number Plate</Text>
              <View style={{ borderRadius: 14, borderWidth: 2, borderColor: carNumber ? ORANGE : "#2A2A2A", overflow: "hidden" }}>
                <LinearGradient colors={carNumber ? ["#1A0E00", "#0A0A0A"] : ["#0F0F0F", "#0A0A0A"]} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 4 }}>
                  <View style={{ marginRight: 12 }}>
                    <Text style={{ color: ORANGE, fontFamily: FONTS.black, fontSize: 18 }}>🇮🇳</Text>
                  </View>
                  <TextInput
                    value={carNumber}
                    onChangeText={v => setCarNumber(v.toUpperCase())}
                    placeholder="MH 12 AB 1234"
                    placeholderTextColor="#444444"
                    autoCapitalize="characters"
                    style={{ flex: 1, color: ORANGE, fontFamily: FONTS.black, fontSize: 22, letterSpacing: 3, paddingVertical: 14 }}
                  />
                </LinearGradient>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <EditField label="Make / Brand" value={carMake} onChangeText={setCarMake} placeholder="e.g. Maruti" icon="Car" />
              </View>
              <View style={{ flex: 1 }}>
                <EditField label="Model" value={carModel} onChangeText={setCarModel} placeholder="e.g. Swift" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <EditField label="Year" value={carYear} onChangeText={setCarYear} placeholder="2020" keyboard="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <EditField label="Color" value={carColor} onChangeText={setCarColor} placeholder="e.g. White" />
              </View>
            </View>

            {/* Vehicle photos */}
            <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 6, marginBottom: 10 }}>Vehicle Photos (Optional)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {carPhotos.map((uri, i) => (
                <View key={i} style={{ width: 80, height: 80, borderRadius: 14, overflow: "hidden", borderWidth: 1.5, borderColor: ORANGE + "50" }}>
                  <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
                  <Pressable onPress={() => setCarPhotos(p => p.filter((_, idx) => idx !== i))} style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "white", fontSize: 10, fontFamily: FONTS.bold }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {carPhotos.length < 4 && (
                <Pressable onPress={pickCarPhoto} style={{ width: 80, height: 80, borderRadius: 14, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <Icon name="Camera" size={22} color={C.text3} />
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, textAlign: "center" }}>Add Photo</Text>
                </Pressable>
              )}
            </View>
            {carPhotos.length > 0 && (
              <Text style={{ color: "#22C55E", fontFamily: FONTS.regular, fontSize: 11, marginTop: 8 }}>✓ {carPhotos.length} photo{carPhotos.length > 1 ? "s" : ""} saved</Text>
            )}
          </SectionCard>

          {/* ── Appearance ── */}
          <SectionCard title="Appearance" emoji="🎨">
            {/* Dark / Light toggle */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 22 }}>{mode === "dark" ? "🌙" : "☀️"}</Text>
                <View>
                  <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 14 }}>{mode === "dark" ? "Dark Mode" : "Light Mode"}</Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Toggle theme</Text>
                </View>
              </View>
              <Switch value={mode === "dark"} onValueChange={toggleMode} trackColor={{ false: C.border, true: ORANGE + "60" }} thumbColor={mode === "dark" ? ORANGE : C.text3} />
            </View>
            <Text style={{ color: C.text2, fontFamily: FONTS.semibold, fontSize: 13, marginBottom: 12 }}>Accent Color</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {ACCENT_OPTIONS.map(opt => {
                const isActive = accent === opt.key;
                return (
                  <Pressable key={opt.key} onPress={() => setAccent(opt.key)} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: opt.hex, borderWidth: isActive ? 3 : 0, borderColor: C.text1, shadowColor: opt.hex, shadowOpacity: isActive ? 0.6 : 0, shadowRadius: 8, elevation: isActive ? 6 : 0, alignItems: "center", justifyContent: "center" }}>
                      {isActive && <Icon name="Check" size={18} color="white" />}
                    </View>
                    <Text style={{ color: isActive ? C.text1 : C.text3, fontFamily: isActive ? FONTS.bold : FONTS.regular, fontSize: 10 }}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SectionCard>

          {/* ── Notifications ── */}
          <SectionCard title="Notifications" emoji="🔔">
            {[
              { key: "push" as const,  label: "Push Notifications",  desc: "Job updates, mechanic ETA, payment confirmations", color: ORANGE },
              { key: "email" as const, label: "Email Updates",        desc: "Invoice copies, monthly summaries",               color: BLUE   },
              { key: "sms" as const,   label: "SMS Alerts",           desc: "OTP, urgent job status updates",                  color: "#22C55E" },
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
          </SectionCard>

          {/* ── Privacy & Security ── */}
          <SectionCard title="Privacy & Security" emoji="🔒">
            <Pressable
              onPress={() => router.push("/(auth)/forgot-password" as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: BLUE + "18", borderWidth: 1, borderColor: BLUE + "35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="Key" size={16} color={BLUE} />
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
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ORANGE + "18", borderWidth: 1, borderColor: ORANGE + "35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="ShieldCheck" size={16} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>Privacy Policy</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>How your data is used and stored</Text>
              </View>
              <Icon name="ExternalLink" size={14} color={C.text3} />
            </Pressable>

            <Pressable
              onPress={handleDeleteAccount}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: "#EF444418", borderWidth: 1, borderColor: "#EF444445", alignItems: "center", justifyContent: "center" }}>
                <Icon name="Trash2" size={16} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#EF4444", fontFamily: FONTS.semibold, fontSize: 13.5 }}>Delete Account</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>Permanently remove your data</Text>
              </View>
              <Icon name="ChevronRight" size={16} color="#EF4444" />
            </Pressable>
          </SectionCard>

          {/* ── Help & About ── */}
          <SectionCard title="Help & About" emoji="💬">
            <Pressable
              onPress={() => Linking.openURL("mailto:support@madat24.in?subject=Customer%20Support").catch(() => Alert.alert("Contact", "support@madat24.in"))}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: "#22C55E18", borderWidth: 1, borderColor: "#22C55E35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="LifeBuoy" size={16} color="#22C55E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>Contact Support</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>support@madat24.in · We reply within 24h</Text>
              </View>
              <Icon name="ChevronRight" size={16} color={C.text3} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/(shared)/ai-assistant" as any)}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.divider }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: BLUE + "18", borderWidth: 1, borderColor: BLUE + "35", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 16 }}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>AI Mechanic Helper</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>Quick automotive diagnostics</Text>
              </View>
              <Icon name="ChevronRight" size={16} color={C.text3} />
            </Pressable>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: ORANGE + "18", borderWidth: 1, borderColor: ORANGE + "35", alignItems: "center", justifyContent: "center" }}>
                <Icon name="Info" size={16} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13.5 }}>App Version</Text>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>v{APP_VERSION} · Build 2026.05</Text>
              </View>
            </View>
          </SectionCard>

          {/* ── Save button ── */}
          {editing && (
            <Pressable onPress={handleSave} style={{ borderRadius: 18, overflow: "hidden", marginBottom: 14 }}>
              <LinearGradient colors={[ORANGE, "#EA6C0A"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                <Icon name="Save" size={20} color="white" />
                <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Save Changes</Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* ── Sign out ── */}
          <Pressable onPress={handleLogout} style={{ backgroundColor: C.redDim || "#1A0A0A", borderRadius: 16, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderColor: "#EF444440", marginBottom: 10 }}>
            <Icon name="LogOut" size={20} color="#EF4444" />
            <Text style={{ color: "#EF4444", fontFamily: FONTS.bold, fontSize: 15 }}>Sign Out</Text>
          </Pressable>

          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, textAlign: "center", marginTop: 6 }}>
            MADAT24/7 · Customer App · v{APP_VERSION}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
