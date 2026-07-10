import React, { useState, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, Image,
  Alert, Animated, Dimensions, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Icon from "~/lib/icons/Icon";
import { FONTS, SERVICES } from "~/constants";
import { useTheme } from "~/components/ui";
import { useAuthStore, useMechanicStore } from "~/stores";

const { width } = Dimensions.get("window");

const STEPS = [
  { id: 1, title: "Personal",  icon: "User"      },
  { id: 2, title: "Contact",   icon: "Phone"     },
  { id: 3, title: "Shop",      icon: "Store"     },
  { id: 4, title: "Services",  icon: "Wrench"    },
  { id: 5, title: "Documents", icon: "FileCheck" },
];

// Vehicle types mechanic can service (from user note)
const VEHICLE_EXPERTISE = [
  { id: "car",           label: "Car",           emoji: "🚗", color: "#3B82F6" },
  { id: "bike",          label: "Bike",          emoji: "🏍️", color: "#F97316" },
  { id: "electric-bike", label: "Electric Bike", emoji: "⚡", color: "#06B6D4" },
  { id: "cycle",         label: "Cycle",         emoji: "🚲", color: "#22C55E" },
  { id: "truck",         label: "Truck",         emoji: "🚛", color: "#9333EA" },
  { id: "electric-car",  label: "Electric Car",  emoji: "🔋", color: "#2ECC71" },
  { id: "auto",          label: "Auto-Rickshaw", emoji: "🛺", color: "#F59E0B" },
];

const EXPERTISE = [
  { label: "Cars",            icon: "Car",       color: "#3B82F6" },
  { label: "Bikes",           icon: "Bike",      color: "#FF8C42" },
  { label: "Electric",        icon: "Zap",       color: "#2ECC71" },
  { label: "Heavy Vehicles",  icon: "Truck",     color: "#9B59B6" },
  { label: "Auto-Rickshaw",   icon: "Navigation",color: "#F59E0B" },
];
const EXP_LEVELS = ["< 1 year","1–3 years","3–5 years","5–10 years","10+ years"];

function Field({ label, value, onChangeText, placeholder, keyboard = "default", secure = false, multiline = false, required = false, iconName }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder: string; keyboard?: string; secure?: boolean; multiline?: boolean;
  required?: boolean; iconName?: string;
}) {
  const C = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 7 }}>
        {label}{required && <Text style={{ color: "#3B82F6" }}> *</Text>}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bg1, borderRadius: 14, borderWidth: 1.5, borderColor: focused ? "#3B82F6" : C.border, paddingHorizontal: 14 }}>
        {iconName && <View style={{ marginRight: 10 }}><Icon name={iconName as any} size={18} color={focused ? "#3B82F6" : C.text3} /></View>}
        <TextInput
          value={value} onChangeText={onChangeText}
          placeholder={placeholder} placeholderTextColor={C.text3}
          keyboardType={keyboard as any} secureTextEntry={secure} multiline={multiline}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          autoCapitalize={keyboard === "email-address" ? "none" : undefined}
          style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: multiline ? 14 : 16, minHeight: multiline ? 90 : undefined, textAlignVertical: multiline ? "top" : "center" }}
        />
      </View>
    </View>
  );
}

function Chip({ label, iconName, color, selected, onPress }: { label: string; iconName?: string; color: string; selected: boolean; onPress: () => void }) {
  const C = useTheme();
  return (
    <Pressable onPress={onPress} style={{ marginRight: 8, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, backgroundColor: selected ? color + "20" : C.bg1, borderColor: selected ? color : C.border }}>
        {iconName && <Icon name={iconName as any} size={14} color={selected ? color : C.text3} />}
        <Text style={{ color: selected ? color : C.text2, fontFamily: selected ? FONTS.semibold : FONTS.regular, fontSize: 13 }}>{label}</Text>
        {selected && <Icon name="Check" size={12} color={color} />}
      </View>
    </Pressable>
  );
}

export default function MechanicSignup() {
  const C = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopDesc, setShopDesc] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [pincode, setPincode] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  // Photo uploads
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [idPhoto,      setIdPhoto]      = useState<string | null>(null);
  const [certPhoto,    setCertPhoto]    = useState<string | null>(null);
  // Vehicle types this mechanic can service
  const [vehicleExpertise, setVehicleExpertise] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedExpertise, setSelectedExpertise] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");

  const { signup } = useAuthStore();
  const { setShopProfile } = useMechanicStore();


  const animateNext = () => {
    Animated.sequence([
      Animated.timing(slideAnim, { toValue: -14, duration: 100, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
  };
  const goNext = () => { animateNext(); setStep(s => s + 1); };
  const goBack = () => { if (step === 1) { router.back(); return; } setStep(s => s - 1); };

  // ── Photo picker — camera OR gallery ─────────────────────────
  const pickPhoto = async (setter: (uri: string) => void) => {
    Alert.alert("Upload Photo", "Choose source", [
      {
        text: "📷 Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow camera access in settings"); return; }
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
          });
          if (!res.canceled && res.assets[0]) setter(res.assets[0].uri);
        },
      },
      {
        text: "🖼️ Gallery",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Allow gallery access in settings"); return; }
          const res = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
          if (!res.canceled && res.assets[0]) setter(res.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const toggleVehicleExpertise = (id: string) => {
    setVehicleExpertise(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };


  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      await signup({ name, email, phone, password }, "mechanic");
      // Create a real shop profile from what the mechanic entered (no mock data)
      setShopProfile({
        id: `shop-${Date.now()}`,
        mechanicId: `mech-${Date.now()}`,
        shopName: shopName || name + "'s Auto Repair",
        description: shopDesc,
        location: {
          address: address || "Shop Location",
          city: city || "Bangalore",
          state: stateVal || "Karnataka",
          pincode: pincode || "560001",
          coordinates: { lat: 12.9716, lng: 77.5946 },
        },
        services: selectedServices.length > 0 ? selectedServices as any : [],
        gstNumber: gstNumber || undefined,
        whatsappNumber: whatsapp || phone,
        hourlyRate: parseFloat(hourlyRate) || 500,
        yearsOfExperience: 0,
        rating: 0,          // starts at zero
        reviewCount: 0,     // starts at zero
        responseRate: 0,    // starts at zero
        completionRate: 0,  // starts at zero
        isOnline: false,
      });
      setStep(6);
    } catch (err: any) {
      const msg = err?.message || "Signup failed. Please try again.";
      Alert.alert("Signup Error", msg);
    }
    finally { setLoading(false); }
  };

  const validateAndNext = () => {
    if (step === 1) {
      if (!name.trim()) { Alert.alert("Required", "Please enter your full name"); return; }
      if (!email.includes("@")) { Alert.alert("Required", "Please enter a valid email"); return; }
      if (phone.replace(/\D/g, "").length < 10) { Alert.alert("Required", "Please enter a valid phone number"); return; }
      if (password.length < 6) { Alert.alert("Required", "Password must be at least 6 characters"); return; }
      if (password !== confirmPass) { Alert.alert("Error", "Passwords do not match"); return; }
      goNext();
    } else if (step === 2) {
      goNext();
    } else if (step === 3) {
      if (!shopName.trim()) { Alert.alert("Required", "Please enter your shop name"); return; }
      goNext();
    } else if (step === 4) {
      if (selectedServices.length === 0) { Alert.alert("Required", "Select at least one service you offer"); return; }
      goNext();
    } else if (step === 5) {
      handleFinalSubmit();
    }
  };

  const progress = ((step - 1) / 4) * 100;

  // ── SUCCESS ───────────────────────────────────────────────────
  if (step === 6) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", paddingTop: 48, marginBottom: 32 }}>
          <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: C.green + "20", borderWidth: 3, borderColor: C.green, alignItems: "center", justifyContent: "center", marginBottom: 24, shadowColor: C.green, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 }}>
            <Icon name="CheckCircle" size={56} color={C.green} />
          </View>
          <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 30, textAlign: "center", marginBottom: 10 }}>You're All Set!</Text>
          <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 15, textAlign: "center", lineHeight: 24 }}>
            Your mechanic account is ready.{"\n"}Go online and start accepting requests!
          </Text>
        </View>
        {[
          { icon: "IndianRupee", title: "Earn based on your work",     sub: "Get paid per completed job — no targets",        color: C.green   },
          { icon: "Bell",        title: "Real-time Request Alerts",     sub: "Customers nearby send you instant requests",     color: "#3B82F6" },
          { icon: "Star",        title: "Build Your Reputation",        sub: "Reviews from customers after each job",          color: C.yellow  },
          { icon: "Clock",       title: "Work on Your Schedule",        sub: "Go online/offline anytime",                     color: C.orange  },
        ].map((b, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 10, borderWidth: 1, borderColor: b.color + "25" }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: b.color + "20", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name={b.icon as any} size={24} color={b.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 14 }}>{b.title}</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>{b.sub}</Text>
            </View>
          </View>
        ))}
        <Pressable onPress={() => router.replace("/(mechanic)/dashboard")} style={{ marginTop: 20, borderRadius: 16, overflow: "hidden" }}>
          <LinearGradient colors={["#3B82F6", "#1D4ED8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 20, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
            <Icon name="LayoutDashboard" size={22} color="white" />
            <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 17 }}>Go to My Dashboard</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Pressable onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg1, alignItems: "center", justifyContent: "center" }}>
              <Icon name="ArrowLeft" size={20} color={C.text2} />
            </Pressable>
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Mechanic Registration</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Step {step} of {STEPS.length}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ height: 5, backgroundColor: C.bg1, borderRadius: 3, marginBottom: 14 }}>
            <LinearGradient colors={["#3B82F6", "#2ECC71"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 5, borderRadius: 3, width: `${progress}%` }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 }}>
            {STEPS.map(s => {
              const done = step > s.id; const active = step === s.id;
              return (
                <View key={s.id} style={{ alignItems: "center", flex: 1 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: done ? C.green : active ? "#3B82F6" : C.bg1, borderWidth: 2, borderColor: done ? C.green : active ? "#3B82F6" : C.border, alignItems: "center", justifyContent: "center", marginBottom: 5 }}>
                    {done ? <Icon name="Check" size={15} color="white" /> : <Icon name={s.icon as any} size={15} color={active ? "white" : C.text3} />}
                  </View>
                  <Text style={{ color: active ? "#3B82F6" : done ? C.green : C.text3, fontFamily: active || done ? FONTS.semibold : FONTS.regular, fontSize: 10, textAlign: "center" }}>{s.title}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 130 }}>
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>

            {/* STEP 1: Personal */}
            {step === 1 && (
              <View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26, marginBottom: 6 }}>Create Your{"\n"}Mechanic Account</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginBottom: 22 }}>Fill in your personal details below</Text>
                <Field label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Amit Kumar" required iconName="User" />
                <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="amit@email.com" keyboard="email-address" required iconName="Mail" />
                <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="+91 9876543210" keyboard="phone-pad" required iconName="Phone" />
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 7 }}>Password <Text style={{ color: "#3B82F6" }}>*</Text></Text>
                  <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.bg1, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14 }}>
                    <View style={{ marginRight: 10 }}><Icon name="Lock" size={18} color={C.text3} /></View>
                    <TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPass} placeholder="Min 6 characters" placeholderTextColor={C.text3} style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 16 }} />
                    <Pressable onPress={() => setShowPass(!showPass)}><Icon name={showPass ? "EyeOff" : "Eye"} size={18} color={C.text3} /></Pressable>
                  </View>
                </View>
                <Field label="Confirm Password" value={confirmPass} onChangeText={setConfirmPass} placeholder="Re-enter password" secure={!showPass} iconName="Lock" required />
              </View>
            )}

            {/* STEP 2: Contact */}
            {step === 2 && (
              <View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26, marginBottom: 6 }}>Confirm Your{"\n"}Contact Details</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginBottom: 22 }}>OTP verification is disabled for this MVP build. You can continue with email, mobile, and password.</Text>
                <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.cardBorder, gap: 14 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Icon name="Mail" size={20} color="#3B82F6" />
                    <Text style={{ color: C.text1, fontFamily: FONTS.medium, fontSize: 14, flex: 1 }}>{email.trim().toLowerCase()}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Icon name="Phone" size={20} color="#3B82F6" />
                    <Text style={{ color: C.text1, fontFamily: FONTS.medium, fontSize: 14, flex: 1 }}>{phone.trim()}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 3: Shop Details */}
            {step === 3 && (
              <View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26, marginBottom: 6 }}>Your Workshop{"\n"}Details</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginBottom: 22 }}>Where is your shop located?</Text>
                <Field label="Shop / Garage Name" value={shopName} onChangeText={setShopName} placeholder="e.g. Amit's Auto Repair" required iconName="Store" />
                <Field label="About Your Shop" value={shopDesc} onChangeText={setShopDesc} placeholder="Describe your expertise..." multiline iconName="FileText" />
                <Pressable onPress={async () => {
                  try {
                    const ExpoLoc = require("expo-location");
                    const { status } = await ExpoLoc.requestForegroundPermissionsAsync();
                    if (status === "granted") {
                      const loc = await ExpoLoc.getCurrentPositionAsync({ accuracy: ExpoLoc.Accuracy.Balanced });
                      const geo = await ExpoLoc.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                      if (geo.length > 0) {
                        const g = geo[0];
                        setAddress([g.name, g.street].filter(Boolean).join(", "));
                        setCity(g.city || g.region || "");
                        setStateVal(g.region || "");
                        setPincode(g.postalCode || "");
                        return;
                      }
                    }
                  } catch {}
                  setAddress("Shop Location"); setCity("Bangalore"); setStateVal("Karnataka"); setPincode("560001");
                }} style={{ backgroundColor: C.green + "15", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, borderWidth: 1, borderColor: C.green + "40" }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.green + "25", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="Navigation" size={20} color={C.green} />
                  </View>
                  <View>
                    <Text style={{ color: C.green, fontFamily: FONTS.semibold, fontSize: 14 }}>Use GPS Location</Text>
                    <Text style={{ color: C.green + "88", fontFamily: FONTS.regular, fontSize: 12 }}>Auto-fill from your current location</Text>
                  </View>
                </Pressable>
                <Field label="Street Address" value={address} onChangeText={setAddress} placeholder="Shop number, street" required iconName="MapPin" />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Field label="City" value={city} onChangeText={setCity} placeholder="Bangalore" required /></View>
                  <View style={{ flex: 1 }}><Field label="Pincode" value={pincode} onChangeText={setPincode} placeholder="560001" keyboard="numeric" required /></View>
                </View>
                <Field label="State" value={stateVal} onChangeText={setStateVal} placeholder="Karnataka" required iconName="Map" />
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
                <Field label="WhatsApp Number" value={whatsapp} onChangeText={setWhatsapp} placeholder="+91 9876543210" keyboard="phone-pad" iconName="MessageCircle" />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}><Field label="Hourly Rate (₹)" value={hourlyRate} onChangeText={setHourlyRate} placeholder="500" keyboard="numeric" iconName="IndianRupee" /></View>
                  <View style={{ flex: 1 }}><Field label="GST (Optional)" value={gstNumber} onChangeText={setGstNumber} placeholder="29XXXXX" iconName="Receipt" /></View>
                </View>
              </View>
            )}

            {/* STEP 4: Services */}
            {step === 4 && (
              <View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26, marginBottom: 6 }}>Services &{"\n"}Expertise</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginBottom: 22 }}>Select what you offer</Text>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Services You Provide</Text>
                  <View style={{ backgroundColor: "#3B82F620", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                    <Text style={{ color: "#3B82F6", fontFamily: FONTS.semibold, fontSize: 12 }}>{selectedServices.length} selected</Text>
                  </View>
                </View>
                {(SERVICES as readonly any[]).map(svc => (
                  <Pressable key={svc.type} onPress={() => setSelectedServices(p => p.includes(svc.type) ? p.filter(s => s !== svc.type) : [...p, svc.type])} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: selectedServices.includes(svc.type) ? svc.color + "15" : C.card, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: selectedServices.includes(svc.type) ? svc.color : C.cardBorder }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: svc.color + (selectedServices.includes(svc.type) ? "25" : "15"), alignItems: "center", justifyContent: "center" }}>
                          <Icon name={svc.icon as any} size={22} color={svc.color} />
                        </View>
                        <View>
                          <Text style={{ color: selectedServices.includes(svc.type) ? C.text1 : C.text2, fontFamily: FONTS.semibold, fontSize: 14 }}>{svc.label}</Text>
                          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Base: ₹{svc.basePrice}</Text>
                        </View>
                      </View>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: selectedServices.includes(svc.type) ? svc.color : C.bg1, borderWidth: selectedServices.includes(svc.type) ? 0 : 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                        {selectedServices.includes(svc.type) && <Icon name="Check" size={14} color="white" />}
                      </View>
                    </View>
                  </Pressable>
                ))}
                <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16, marginTop: 18, marginBottom: 12 }}>Vehicle Expertise</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {EXPERTISE.map(e => <Chip key={e.label} label={e.label} iconName={e.icon} color={e.color} selected={selectedExpertise.includes(e.label)} onPress={() => setSelectedExpertise(p => p.includes(e.label) ? p.filter(x => x !== e.label) : [...p, e.label])} />)}
                </View>
                <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16, marginTop: 18, marginBottom: 12 }}>Years of Experience</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {EXP_LEVELS.map(lvl => <Chip key={lvl} label={lvl} color={C.orange} selected={experience === lvl} onPress={() => setExperience(lvl)} />)}
                </View>
              </View>
            )}

            {/* STEP 5: Documents + Vehicle Expertise + Photos */}
            {step === 5 && (
              <View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26, marginBottom: 6 }}>Almost Done!</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginBottom: 22 }}>Add your vehicle expertise, photos & documents</Text>

                {/* ── Vehicle types you service ── */}
                <View style={{ marginBottom: 22 }}>
                  <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16, marginBottom: 6 }}>🚗 Which vehicles can you service?</Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginBottom: 14 }}>Customers filter mechanics by vehicle type — select all that apply</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                    {VEHICLE_EXPERTISE.map(v => {
                      const sel = vehicleExpertise.includes(v.id);
                      return (
                        <Pressable key={v.id} onPress={() => toggleVehicleExpertise(v.id)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: sel ? v.color + "20" : C.bg1, borderWidth: 1.5, borderColor: sel ? v.color : C.border }}>
                          <Text style={{ fontSize: 16 }}>{v.emoji}</Text>
                          <Text style={{ color: sel ? v.color : C.text2, fontFamily: sel ? FONTS.semibold : FONTS.regular, fontSize: 13 }}>{v.label}</Text>
                          {sel && <Text style={{ color: v.color, fontSize: 12 }}>✓</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* ── Profile photo ── */}
                <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16, marginBottom: 14 }}>📸 Your Photos</Text>

                {/* Profile photo */}
                <Pressable onPress={() => pickPhoto(setProfilePhoto)} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.bg1, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: profilePhoto ? "#F97316" : C.border }}>
                    {profilePhoto ? (
                      <Image source={{ uri: profilePhoto }} style={{ width: 56, height: 56, borderRadius: 14 }} />
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#F9731620", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="Camera" size={26} color="#F97316" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: profilePhoto ? C.text1 : C.text2, fontFamily: FONTS.semibold, fontSize: 14 }}>Profile Photo{!profilePhoto && " *"}</Text>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>{profilePhoto ? "✓ Photo selected — tap to change" : "Camera or gallery"}</Text>
                    </View>
                    <Icon name={profilePhoto ? "CheckCircle" : "ChevronRight"} size={20} color={profilePhoto ? "#F97316" : C.text3} />
                  </View>
                </Pressable>

                {/* Aadhaar / ID photo */}
                <Pressable onPress={() => pickPhoto(setIdPhoto)} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.bg1, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: idPhoto ? "#3B82F6" : C.border }}>
                    {idPhoto ? (
                      <Image source={{ uri: idPhoto }} style={{ width: 56, height: 56, borderRadius: 14 }} />
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#3B82F620", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="CreditCard" size={26} color="#3B82F6" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: idPhoto ? C.text1 : C.text2, fontFamily: FONTS.semibold, fontSize: 14 }}>Aadhaar Card / ID</Text>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>{idPhoto ? "✓ ID selected — tap to change" : "Front side photo"}</Text>
                    </View>
                    <Icon name={idPhoto ? "CheckCircle" : "ChevronRight"} size={20} color={idPhoto ? "#3B82F6" : C.text3} />
                  </View>
                </Pressable>

                {/* Work certificate (optional) */}
                <Pressable onPress={() => pickPhoto(setCertPhoto)} style={{ marginBottom: 22 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.bg1, borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: certPhoto ? "#22C55E" : C.border }}>
                    {certPhoto ? (
                      <Image source={{ uri: certPhoto }} style={{ width: 56, height: 56, borderRadius: 14 }} />
                    ) : (
                      <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: "#22C55E20", alignItems: "center", justifyContent: "center" }}>
                        <Icon name="Award" size={26} color="#22C55E" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: certPhoto ? C.text1 : C.text2, fontFamily: FONTS.semibold, fontSize: 14 }}>Work Certificate <Text style={{ color: C.text3, fontSize: 12 }}>(Optional)</Text></Text>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 3 }}>{certPhoto ? "✓ Certificate selected" : "ITI / mechanic certification"}</Text>
                    </View>
                    <Icon name={certPhoto ? "CheckCircle" : "ChevronRight"} size={20} color={certPhoto ? "#22C55E" : C.text3} />
                  </View>
                </Pressable>

                {/* Aadhaar + PAN text */}
                <View style={{ backgroundColor: "#3B82F615", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, borderWidth: 1, borderColor: "#3B82F630" }}>
                  <Icon name="ShieldCheck" size={22} color="#3B82F6" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#3B82F6", fontFamily: FONTS.semibold, fontSize: 13 }}>100% Secure & Encrypted</Text>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Documents only used for verification</Text>
                  </View>
                </View>
                <Field label="Aadhaar Number" value={aadhaar} onChangeText={setAadhaar} placeholder="XXXX XXXX XXXX" keyboard="numeric" iconName="CreditCard" />
                <Field label="PAN Number" value={pan} onChangeText={setPan} placeholder="ABCDE1234F" iconName="FileText" />

                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 14 }} />
                <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 12 }}>🏦 Bank Account (for payouts)</Text>
                <Field label="Account Number" value={bankAccount} onChangeText={setBankAccount} placeholder="XXXXXXXXXX" keyboard="numeric" iconName="Landmark" />
                <Field label="IFSC Code" value={ifsc} onChangeText={setIfsc} placeholder="SBIN0001234" iconName="Hash" />

                {/* Summary */}
                <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 18, marginTop: 6, borderWidth: 1, borderColor: C.cardBorder }}>
                  <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 12 }}>📋 Registration Summary</Text>
                  {[
                    ["Name",      name || "—"],
                    ["Email",     email || "—"],
                    ["Shop",      shopName || "—"],
                    ["City",      city || "—"],
                    ["Vehicles",  vehicleExpertise.length > 0 ? vehicleExpertise.map(id => VEHICLE_EXPERTISE.find(v => v.id === id)?.label).join(", ") : "None selected"],
                    ["Services",  selectedServices.length > 0 ? `${selectedServices.length} selected` : "None"],
                    ["Profile Photo", profilePhoto ? "✓ Uploaded" : "Not added"],
                  ].map(([l, v]) => (
                    <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border }}>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>{l}</Text>
                      <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, flex: 1, textAlign: "right" }}>{v}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

          </Animated.View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.bg + "F8", borderTopWidth: 1, borderTopColor: C.border, padding: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
          <Pressable onPress={validateAndNext} disabled={loading} style={({ pressed }) => ({ opacity: pressed || loading ? 0.85 : 1, borderRadius: 16, overflow: "hidden" })}>
            <LinearGradient
              colors={step === 5 ? [C.green, C.greenDark] : ["#3B82F6","#1D4ED8"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
            >
              <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 16 }}>
                {loading ? "Creating Account..." : step === 5 ? "Create Account & Start Earning" : "Continue"}
              </Text>
              <Icon name={step === 5 ? "CheckCircle" : "ArrowRight"} size={20} color="white" />
            </LinearGradient>
          </Pressable>
          {step === 1 && (
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Already registered?</Text>
              <Pressable onPress={() => router.push("/(auth)/mechanic-login")}><Text style={{ color: "#3B82F6", fontFamily: FONTS.semibold, fontSize: 13 }}>Login</Text></Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
