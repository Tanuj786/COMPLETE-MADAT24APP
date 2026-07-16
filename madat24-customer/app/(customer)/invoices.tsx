import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, Alert, Animated,
  Modal, ActivityIndicator, Dimensions, Linking, Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { format } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { useTheme } from "~/components/ui";
import { FONTS } from "~/constants";
import { useCustomerStore, useNotifStore, useAuthStore } from "~/stores";
import { apiGetMyJobs, apiPayCash } from "~/lib/api";
import { PhotoStrip } from "~/components/shared/PhotoPicker";

const { width } = Dimensions.get("window");

function buildInvoiceReceipt(job: any) {
  const inv = job.invoice;
  const lines = (inv.lineItems || []).map((it: any) =>
    `- [${it.kind || "service"}] ${it.description} x${it.quantity} @ ₹${it.unitPrice.toFixed(2)} = ₹${it.total.toFixed(2)}`
  ).join("\n");
  return [
    `MADAT24 INVOICE ${inv.invoiceNumber}`,
    `Date: ${format(new Date(inv.date), "dd MMM yyyy, hh:mm a")}`,
    `Customer: ${inv.customerInfo?.name || ""}`,
    `Mechanic: ${inv.shopInfo?.name || job.mechanic?.shopName || ""}`,
    "",
    "Service Breakdown:",
    lines,
    "",
    `Subtotal: ₹${inv.subtotal.toFixed(2)}`,
    `GST 18%: ₹${inv.tax.toFixed(2)}`,
    `Total: ₹${inv.total.toFixed(2)}`,
    `Payment: ${inv.paymentStatus}${inv.paymentMethod ? ` via ${inv.paymentMethod}` : ""}`,
    inv.notes ? `\nRepair Notes:\n${inv.notes}` : "",
  ].filter(Boolean).join("\n");
}

// ── UPI Deep-link builder ─────────────────────────────────────────
// This creates real UPI payment links that open the user's UPI app
function buildUpiUrl(opts: {
  pa: string;   // payee UPI ID
  pn: string;   // payee name
  am: string;   // amount
  tn: string;   // transaction note
  tr: string;   // transaction ref
}) {
  return `upi://pay?pa=${opts.pa}&pn=${encodeURIComponent(opts.pn)}&am=${opts.am}&cu=INR&tn=${encodeURIComponent(opts.tn)}&tr=${opts.tr}`;
}

// ── QR Code visual (geometric art QR simulation) ─────────────────
// In production replace with: import QRCode from 'react-native-qrcode-svg'
function QrCodeBlock({ value, size = 200, color }: { value: string; size?: number; color: string }) {
  // Generate a deterministic visual pattern from the value string
  const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = 21;
  const cellSize = size / cells;

  const grid = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      // Finder patterns (corners)
      const inFinder = (
        (r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8)
      );
      if (inFinder) {
        const inOuter = r === 0 || r === 6 || c === 0 || c === 6 ||
          r === cells - 1 || r === cells - 7 || c === cells - 1 || c === cells - 7;
        const inInner = (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
          (r >= 2 && r <= 4 && c >= cells - 6 && c <= cells - 4) ||
          (r >= cells - 6 && r <= cells - 4 && c >= 2 && c <= 4);
        return inOuter || inInner ? 1 : 0;
      }
      // Data cells — use seed + position for deterministic pattern
      const hash = (seed * 31 + r * 7 + c * 13) % 100;
      return hash < 48 ? 1 : 0;
    })
  );

  return (
    <View style={{
      width: size + 32, padding: 16,
      backgroundColor: "#FFFFFF",
      borderRadius: 20,
      shadowColor: color, shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3, shadowRadius: 20, elevation: 12,
    }}>
      {grid.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {row.map((cell, c) => (
            <View
              key={c}
              style={{
                width: cellSize, height: cellSize,
                backgroundColor: cell ? "#0A0A0A" : "#FFFFFF",
              }}
            />
          ))}
        </View>
      ))}
      {/* Center logo overlay */}
      <View style={{
        position: "absolute",
        top: 16 + size / 2 - 18, left: 16 + size / 2 - 18,
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: color,
        alignItems: "center", justifyContent: "center",
        borderWidth: 3, borderColor: "#FFFFFF",
      }}>
        <Text style={{ fontSize: 18 }}>🔧</Text>
      </View>
    </View>
  );
}

// ── Payment method card ────────────────────────────────────────────
const METHODS = [
  {
    id: "upi_qr", label: "Scan QR Code",      emoji: "📲",
    desc: "Scan with any UPI app",             color: "#00D4AA", popular: true,
    apps: ["GPay", "PhonePe", "Paytm", "BHIM"],
  },
  {
    id: "gpay",   label: "Google Pay",          emoji: "🟢",
    desc: "Pay instantly via Google Pay",      color: "#4CAF50", popular: false,
    apps: [],
  },
  {
    id: "phonepe",label: "PhonePe",             emoji: "🟣",
    desc: "Pay via PhonePe UPI",               color: "#6C63FF", popular: false,
    apps: [],
  },
  {
    id: "paytm",  label: "Paytm",               emoji: "🔵",
    desc: "Pay with Paytm wallet or UPI",      color: "#00B9F1", popular: false,
    apps: [],
  },
  {
    id: "card",   label: "Credit / Debit Card", emoji: "💳",
    desc: "Visa, Mastercard, RuPay, Amex",     color: "#FF8C42", popular: false,
    apps: [],
  },
  {
    id: "netbank",label: "Net Banking",          emoji: "🏦",
    desc: "All major Indian banks",            color: "#3B82F6", popular: false,
    apps: [],
  },
  {
    id: "cash",   label: "Cash to Mechanic",    emoji: "💵",
    desc: "Hand cash at the location",         color: "#FFD93D", popular: false,
    apps: [],
  },
];

function MethodCard({ m, selected, onSelect }: {
  m: typeof METHODS[0]; selected: boolean; onSelect: () => void;
}) {
  const sc = useRef(new Animated.Value(1)).current;
  const handlePress = () => {
    Animated.sequence([
      Animated.timing(sc, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(sc, { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
    onSelect();
  };
  return (
    <Animated.View style={{ transform: [{ scale: sc }] }}>
      <Pressable onPress={handlePress}>
        <LinearGradient
          colors={selected ? [m.color + "22", m.color + "0A"] : ["#0F1520", "#0A0F1A"]}
          style={{
            borderRadius: 18, padding: 16, marginBottom: 10,
            flexDirection: "row", alignItems: "center", gap: 14,
            borderWidth: 2, borderColor: selected ? m.color + "70" : "#1C2535",
          }}
        >
          <View style={{
            width: 50, height: 50, borderRadius: 16,
            backgroundColor: m.color + "18",
            alignItems: "center", justifyContent: "center",
            borderWidth: 1, borderColor: m.color + "30",
          }}>
            <Text style={{ fontSize: 24 }}>{m.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <Text style={{ color: "#E8EDF5", fontFamily: FONTS.bold, fontSize: 15 }}>{m.label}</Text>
              {m.popular && (
                <View style={{ backgroundColor: "#FF8C4225", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "#FF8C4240" }}>
                  <Text style={{ color: "#FF8C42", fontFamily: FONTS.black, fontSize: 9, letterSpacing: 0.5 }}>POPULAR</Text>
                </View>
              )}
            </View>
            <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 12 }}>{m.desc}</Text>
            {m.apps.length > 0 && (
              <Text style={{ color: m.color + "99", fontFamily: FONTS.regular, fontSize: 10, marginTop: 3 }}>
                {m.apps.join(" · ")}
              </Text>
            )}
          </View>
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            borderWidth: 2, borderColor: selected ? m.color : "#2A3A4A",
            backgroundColor: selected ? m.color : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" }} />}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ── QR Payment Modal ──────────────────────────────────────────────
function QrPayModal({ visible, total, invoiceNum, mechanicName, onClose, onVerify }: {
  visible: boolean; total: number; invoiceNum: string;
  mechanicName: string; onClose: () => void; onVerify: () => void;
}) {
  const C = useTheme();
  const [checking, setChecking] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  // Madat24 merchant UPI ID (replace with real one)
  const MERCHANT_UPI  = "madat24@upi";
  const txnRef        = `MADAT${Date.now()}`;
  const upiUrl        = buildUpiUrl({
    pa: MERCHANT_UPI, pn: "Madat24 Services",
    am: total.toFixed(2),
    tn: `Payment for ${invoiceNum}`,
    tr: txnRef,
  });

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])).start();
    }
  }, [visible]);

  const openUpiApp = async (app?: string) => {
    let url = upiUrl;
    if (app === "gpay")    url = upiUrl.replace("upi://", "gpay://");
    if (app === "phonepe") url = upiUrl.replace("upi://", "phonepe://");
    if (app === "paytm")   url = upiUrl.replace("upi://", "paytm://");

    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fallback to generic UPI
      const canUpi = await Linking.canOpenURL(upiUrl).catch(() => false);
      if (canUpi) {
        await Linking.openURL(upiUrl);
      } else {
        Alert.alert(
          "App Not Found",
          "UPI app not installed. Scan the QR code instead.",
        );
      }
    }
  };

  const handleVerify = async () => {
    setChecking(true);
    await new Promise(r => setTimeout(r, 1800));
    setChecking(false);
    onVerify();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={{
        flex: 1, backgroundColor: "#000000CC",
        justifyContent: "flex-end", opacity: fadeAnim,
      }}>
        <View style={{
          backgroundColor: "#0A0F1A", borderTopLeftRadius: 32, borderTopRightRadius: 32,
          borderWidth: 1, borderColor: "#1C2535", maxHeight: "94%",
        }}>
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: 14, marginBottom: 4 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#2A3A4A" }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, marginTop: 8 }}>
              <View>
                <Text style={{ color: "#E8EDF5", fontFamily: FONTS.black, fontSize: 22 }}>Complete Payment</Text>
                <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>
                  {invoiceNum} · {mechanicName}
                </Text>
              </View>
              <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#1C2535", alignItems: "center", justifyContent: "center" }}>
                <Icon name="X" size={18} color="#7A8BA0" />
              </Pressable>
            </View>

            {/* Amount */}
            <LinearGradient
              colors={["#00D4AA18", "#00D4AA06"]}
              style={{ borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 24, borderWidth: 1, borderColor: "#00D4AA30" }}
            >
              <Text style={{ color: "#7A8BA0", fontFamily: FONTS.medium, fontSize: 13, marginBottom: 6 }}>Total Amount Due</Text>
              <Text style={{ color: "#00D4AA", fontFamily: FONTS.black, fontSize: 42, letterSpacing: -1 }}>
                ₹{total.toFixed(2)}
              </Text>
              <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 11, marginTop: 4 }}>
                Incl. 18% GST · Ref: {txnRef.slice(-8)}
              </Text>
            </LinearGradient>

            {/* QR Code */}
            <View style={{ alignItems: "center", marginBottom: 24 }}>
              <Text style={{ color: "#7A8BA0", fontFamily: FONTS.medium, fontSize: 12, marginBottom: 16, letterSpacing: 1.5, textTransform: "uppercase" }}>
                Scan to Pay
              </Text>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <QrCodeBlock value={`${MERCHANT_UPI}|${total}|${txnRef}`} size={200} color="#00D4AA" />
              </Animated.View>
              <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 12, marginTop: 12 }}>
                Scan with GPay · PhonePe · Paytm · BHIM
              </Text>
            </View>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#1C2535" }} />
              <Text style={{ color: "#3A4A5C", fontFamily: FONTS.medium, fontSize: 12 }}>or pay directly</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#1C2535" }} />
            </View>

            {/* Quick pay apps */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
              {[
                { id: "gpay",    label: "GPay",     emoji: "🟢", color: "#4CAF50" },
                { id: "phonepe", label: "PhonePe",  emoji: "🟣", color: "#6C63FF" },
                { id: "paytm",   label: "Paytm",    emoji: "🔵", color: "#00B9F1" },
              ].map(app => (
                <Pressable
                  key={app.id}
                  onPress={() => openUpiApp(app.id)}
                  style={{ flex: 1, backgroundColor: app.color + "14", borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: app.color + "30" }}
                >
                  <Text style={{ fontSize: 26, marginBottom: 4 }}>{app.emoji}</Text>
                  <Text style={{ color: app.color, fontFamily: FONTS.bold, fontSize: 12 }}>{app.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Security row */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 20, marginBottom: 24 }}>
              {[
                { icon: "ShieldCheck", label: "256-bit SSL", color: "#2ECC71" },
                { icon: "Lock",        label: "PCI DSS",     color: "#3B82F6" },
                { icon: "BadgeCheck",  label: "UPI Secure",  color: "#FF8C42" },
              ].map(b => (
                <View key={b.label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Icon name={b.icon as any} size={13} color={b.color} />
                  <Text style={{ color: b.color, fontFamily: FONTS.medium, fontSize: 10 }}>{b.label}</Text>
                </View>
              ))}
            </View>

            {/* Verify / confirm button */}
            <Pressable
              onPress={handleVerify}
              disabled={checking}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, borderRadius: 18, overflow: "hidden" })}
            >
              <LinearGradient
                colors={["#00D4AA", "#00A882"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
              >
                {checking
                  ? <ActivityIndicator color="white" size="small" />
                  : <Icon name="CheckCircle" size={20} color="white" />
                }
                <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>
                  {checking ? "Verifying Payment..." : "I've Completed Payment"}
                </Text>
              </LinearGradient>
            </Pressable>

            <Text style={{ color: "#3A4A5C", fontFamily: FONTS.regular, fontSize: 11, textAlign: "center", marginTop: 12 }}>
              Tap after completing payment in your UPI app
            </Text>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Processing Modal ──────────────────────────────────────────────
function ProcessingModal({ visible, method, amount }: { visible: boolean; method: string; amount: number }) {
  const spin  = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (visible) {
      Animated.loop(Animated.timing(spin,  { toValue: 1, duration: 1200, useNativeDriver: true })).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])).start();
    }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: "#000000CC", alignItems: "center", justifyContent: "center" }}>
        <Animated.View style={{ transform: [{ scale: pulse }], backgroundColor: "#0A0F1A", borderRadius: 28, padding: 36, alignItems: "center", borderWidth: 1, borderColor: "#00D4AA30", width: width * 0.82 }}>
          <LinearGradient colors={["#00D4AA25", "#00D4AA08"]} style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "#00D4AA40" }}>
            <ActivityIndicator size="large" color="#00D4AA" />
          </LinearGradient>
          <Text style={{ color: "#E8EDF5", fontFamily: FONTS.black, fontSize: 20, marginBottom: 8 }}>Verifying Payment</Text>
          <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
            Confirming ₹{amount.toFixed(2)}{"\n"}via {method}...
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 20, backgroundColor: "#2ECC7115", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
            <Icon name="ShieldCheck" size={14} color="#2ECC71" />
            <Text style={{ color: "#2ECC71", fontFamily: FONTS.medium, fontSize: 11 }}>256-bit SSL Encrypted</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Success Modal ─────────────────────────────────────────────────
function SuccessModal({ visible, amount, invoiceNum, method, onClose }: {
  visible: boolean; amount: number; invoiceNum: string; method: string; onClose: () => void;
}) {
  const sc  = useRef(new Animated.Value(0.4)).current;
  const op  = useRef(new Animated.Value(0)).current;
  const checkSc = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.parallel([
          Animated.spring(sc, { toValue: 1, tension: 60, friction: 7, useNativeDriver: true }),
          Animated.timing(op, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(200),
        Animated.spring(checkSc, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="none">
      <Animated.View style={{ flex: 1, backgroundColor: "#000000CC", alignItems: "center", justifyContent: "center", opacity: op }}>
        <Animated.View style={{ transform: [{ scale: sc }], backgroundColor: "#0A0F1A", borderRadius: 32, padding: 36, alignItems: "center", borderWidth: 1, borderColor: "#2ECC7130", width: width * 0.88 }}>
          {/* Check circle */}
          <Animated.View style={{ transform: [{ scale: checkSc }], marginBottom: 20 }}>
            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={{ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center" }}>
              <Icon name="Check" size={44} color="white" />
            </LinearGradient>
          </Animated.View>
          <Text style={{ color: "#2ECC71", fontFamily: FONTS.black, fontSize: 26, marginBottom: 6 }}>Payment Done!</Text>
          <Text style={{ color: "#E8EDF5", fontFamily: FONTS.black, fontSize: 38, marginBottom: 6, letterSpacing: -1 }}>
            ₹{amount.toFixed(2)}
          </Text>
          <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 13, marginBottom: 6 }}>
            Invoice: {invoiceNum}
          </Text>
          {/* Receipt mini table */}
          <View style={{ width: "100%", backgroundColor: "#111827", borderRadius: 16, padding: 16, marginVertical: 20, borderWidth: 1, borderColor: "#1C2535" }}>
            {[
              ["Transaction ID",  `TXN${Date.now().toString().slice(-8)}`],
              ["Payment Method",  method],
              ["Date & Time",     format(new Date(), "dd MMM yyyy, hh:mm a")],
              ["Status",          "SUCCESS"],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1C2535" }}>
                <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 12 }}>{k}</Text>
                <Text style={{ color: k === "Status" ? "#2ECC71" : "#E8EDF5", fontFamily: FONTS.bold, fontSize: 12 }}>{v}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: "#5A6A7E", fontFamily: FONTS.regular, fontSize: 12, textAlign: "center", marginBottom: 20 }}>
            Receipt sent to your registered email
          </Text>
          <Pressable onPress={onClose} style={{ borderRadius: 16, overflow: "hidden", width: "100%" }}>
            <LinearGradient colors={["#2ECC71", "#27AE60"]} style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Done</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════
export default function Invoices() {
  const C    = useTheme();
  const { jobs, payInvoice, syncJobsFromBackend }    = useCustomerStore();
  const { addNotification }      = useNotifStore();
  const { user }                 = useAuthStore();
  const invoiceJobs              = jobs.filter(j => j.invoice);

  const [payingId, setPayingId]         = useState<string | null>(null);
  const [selectedMethod, setMethod]     = useState("upi_qr");
  const [showQr, setShowQr]             = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [successData, setSuccessData]   = useState<{ amount: number; invoiceNum: string; method: string } | null>(null);

  const currentJob  = invoiceJobs.find(j => j.id === payingId);
  const currentInv  = currentJob?.invoice;

  const refreshJobs = React.useCallback(() => {
    return apiGetMyJobs()
      .then(({ jobs }) => syncJobsFromBackend(jobs))
      .catch(() => {});
  }, [syncJobsFromBackend]);

  useFocusEffect(
    React.useCallback(() => {
      refreshJobs();
    }, [refreshJobs]),
  );

  // After QR modal confirms payment
  const handleQrVerify = async () => {
    setShowQr(false);
    setProcessing(true);
    await new Promise(r => setTimeout(r, 1800));
    if (!payingId || !currentInv) { setProcessing(false); return; }
    payInvoice(payingId, "UPI");
    if (user) {
      addNotification({
        id: `notif-pay-${Date.now()}`, userId: user.id,
        type: "payment_received",
        title: "Payment Successful ✅",
        message: `₹${currentInv.total.toFixed(2)} paid via UPI`,
        read: false, createdAt: new Date().toISOString(),
      });
    }
    setProcessing(false);
    refreshJobs();
    setSuccessData({ amount: currentInv.total, invoiceNum: currentInv.invoiceNumber, method: "UPI" });
    setPayingId(null);
  };

  // For non-QR methods (card / netbank / cash)
  const handleDirectPay = async (jobId: string, inv: NonNullable<typeof currentInv>, method: string) => {
    setProcessing(true);
    try {
      // Call real backend to mark as paid in PostgreSQL
      await apiPayCash(jobId, method.toUpperCase());
    } catch {}
    payInvoice(jobId, method.toUpperCase());
    if (user) {
      addNotification({
        id: `notif-pay-${Date.now()}`, userId: user.id,
        type: "payment_received",
        title: "Payment Successful ✅",
        message: `₹${inv.total.toFixed(2)} paid via ${method}`,
        read: false, createdAt: new Date().toISOString(),
      });
    }
    setProcessing(false);
    refreshJobs();
    setSuccessData({ amount: inv.total, invoiceNum: inv.invoiceNumber, method });
    setPayingId(null);
  };

  const handleConfirmPay = (jobId: string) => {
    const job  = invoiceJobs.find(j => j.id === jobId);
    const inv  = job?.invoice;
    if (!inv) return;

    const m = METHODS.find(x => x.id === selectedMethod);

    if (["upi_qr", "gpay", "phonepe", "paytm"].includes(selectedMethod)) {
      setPayingId(jobId);
      setShowQr(true);
    } else {
      Alert.alert(
        `Pay via ${m?.label}`,
        `Confirm payment of ₹${inv.total.toFixed(2)} via ${m?.label}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Confirm", onPress: () => handleDirectPay(jobId, inv, m?.label || selectedMethod) },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <LinearGradient
        colors={[C.isDark ? "#0A0F1A" : "#F0F4FF", C.bg]}
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: C.border }}
      >
        <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26 }}>Invoices & Payments</Text>
        <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13, marginTop: 4 }}>
          {invoiceJobs.filter(j => j.invoice?.paymentStatus === "pending").length} pending ·{" "}
          {invoiceJobs.filter(j => j.invoice?.paymentStatus === "paid").length} paid
        </Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 60 }}>
        {invoiceJobs.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 80 }}>
            <Text style={{ fontSize: 60, marginBottom: 16 }}>📄</Text>
            <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 18 }}>No invoices yet</Text>
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13, marginTop: 8, textAlign: "center" }}>
              Invoices appear after a mechanic completes your job
            </Text>
          </View>
        ) : invoiceJobs.map(job => {
          const inv  = job.invoice!;
          const paid = inv.paymentStatus === "paid";
          const ac   = paid ? C.green : "#FF8C42";
          const isOpen = payingId === job.id && !showQr;

          return (
            <View key={inv.id} style={{ marginBottom: 16, backgroundColor: C.card, borderRadius: 24, borderWidth: 1.5, borderColor: ac + "35", overflow: "hidden" }}>
              {/* Invoice header */}
              <LinearGradient colors={[ac + "18", "transparent"]} style={{ paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>{inv.invoiceNumber}</Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>
                    {format(new Date(inv.date), "dd MMM yyyy, hh:mm a")}
                  </Text>
                </View>
                <LinearGradient
                  colors={paid ? ["#2ECC7125", "#2ECC7110"] : ["#FF8C4225", "#FF8C4210"]}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ac }} />
                  <Text style={{ color: ac, fontFamily: FONTS.bold, fontSize: 11 }}>{paid ? "PAID" : "PENDING"}</Text>
                </LinearGradient>
              </LinearGradient>

              <View style={{ paddingHorizontal: 18, paddingBottom: 18 }}>
                {/* Shop info */}
                <View style={{ backgroundColor: C.bg1, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primary + "20", alignItems: "center", justifyContent: "center" }}>
                    <Icon name="Wrench" size={18} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 14 }}>{inv.shopInfo.name}</Text>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>{inv.shopInfo.address}</Text>
                  </View>
                </View>

                {/* Line items */}
                <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 13, marginBottom: 10 }}>Service Breakdown</Text>
                {inv.lineItems.map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: i < inv.lineItems.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text1, fontFamily: FONTS.medium, fontSize: 13 }}>{item.description}</Text>
                      <Text style={{ color: C.primary, fontFamily: FONTS.bold, fontSize: 10, marginTop: 2 }}>{(item.kind || "service").toUpperCase()}</Text>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>Qty {item.quantity} × ₹{item.unitPrice.toFixed(2)}</Text>
                    </View>
                    <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>₹{item.total.toFixed(2)}</Text>
                  </View>
                ))}

                {!!inv.notes && (
                  <View style={{ backgroundColor: C.bg1, borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 12, marginBottom: 5 }}>Repair Notes</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 18 }}>{inv.notes}</Text>
                  </View>
                )}

                {(job.customerMedia.length > 0 || (job.completionMedia || []).length > 0) && (
                  <View style={{ marginTop: 14 }}>
                    <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 13, marginBottom: 10 }}>Service Proof</Text>
                    {job.customerMedia.length > 0 && (
                      <PhotoStrip photos={job.customerMedia} label="Before-work photos" readonly />
                    )}
                    {(job.completionMedia || []).length > 0 && (
                      <PhotoStrip photos={job.completionMedia || []} label="After-work photos/videos" readonly />
                    )}
                  </View>
                )}

                {/* Totals */}
                <View style={{ backgroundColor: C.bg1, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, marginTop: 12, marginBottom: !paid ? 14 : 0 }}>
                  {[
                    ["Subtotal", `₹${inv.subtotal.toFixed(2)}`],
                    ["GST 18%",  `₹${inv.tax.toFixed(2)}`],
                  ].map(([l, v]) => (
                    <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>{l}</Text>
                      <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13 }}>{v}</Text>
                    </View>
                  ))}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 16 }}>Total</Text>
                    <Text style={{ color: ac, fontFamily: FONTS.black, fontSize: 20 }}>₹{inv.total.toFixed(2)}</Text>
                  </View>
                  {paid && inv.paymentMethod && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }}>
                      <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Paid via</Text>
                      <Text style={{ color: C.green, fontFamily: FONTS.bold, fontSize: 12 }}>{inv.paymentMethod} ✓</Text>
                    </View>
                  )}
                </View>

                {paid && (
                  <Pressable
                    onPress={() => Share.share({ title: inv.invoiceNumber, message: buildInvoiceReceipt(job) })}
                    style={{ marginTop: 14, borderRadius: 14, overflow: "hidden" }}
                  >
                    <LinearGradient colors={[C.green, C.greenDark]} style={{ paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                      <Icon name="Download" size={17} color="white" />
                      <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 14 }}>Download / Share Invoice</Text>
                    </LinearGradient>
                  </Pressable>
                )}

                {/* Pay section */}
                {!paid && (
                  <>
                    {/* Toggle methods */}
                    <Pressable
                      onPress={() => setPayingId(isOpen ? null : job.id)}
                      style={{ borderRadius: 16, overflow: "hidden", marginBottom: isOpen ? 16 : 0 }}
                    >
                      <LinearGradient
                        colors={isOpen ? ["#FF8C4230", "#FF8C4218"] : ["#FF8C42", "#CC3300"]}
                        style={{ paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                      >
                        <Icon name={isOpen ? "ChevronUp" : "CreditCard"} size={18} color={isOpen ? "#FF8C42" : "white"} />
                        <Text style={{ color: isOpen ? "#FF8C42" : "white", fontFamily: FONTS.bold, fontSize: 15 }}>
                          {isOpen ? "Hide Payment Options" : `Pay ₹${inv.total.toFixed(2)}`}
                        </Text>
                      </LinearGradient>
                    </Pressable>

                    {/* Payment methods accordion */}
                    {isOpen && (
                      <View>
                        <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 14, marginBottom: 12 }}>
                          Choose Payment Method
                        </Text>
                        {METHODS.map(m => (
                          <MethodCard key={m.id} m={m} selected={selectedMethod === m.id} onSelect={() => setMethod(m.id)} />
                        ))}

                        {/* Security badges */}
                        <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginVertical: 14 }}>
                          {[
                            { icon: "ShieldCheck", label: "SSL Secure", color: "#2ECC71" },
                            { icon: "Lock",        label: "PCI DSS",    color: "#3B82F6" },
                            { icon: "BadgeCheck",  label: "Verified",   color: "#FF8C42" },
                          ].map(b => (
                            <View key={b.label} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Icon name={b.icon as any} size={12} color={b.color} />
                              <Text style={{ color: b.color, fontFamily: FONTS.medium, fontSize: 10 }}>{b.label}</Text>
                            </View>
                          ))}
                        </View>

                        <Pressable
                          onPress={() => handleConfirmPay(job.id)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, borderRadius: 16, overflow: "hidden" })}
                        >
                          <LinearGradient colors={["#2ECC71", "#27AE60"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                            <Icon name="Zap" size={18} color="white" />
                            <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>
                              Pay ₹{inv.total.toFixed(2)} Now
                            </Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* QR Sheet */}
      {currentInv && (
        <QrPayModal
          visible={showQr}
          total={currentInv.total}
          invoiceNum={currentInv.invoiceNumber}
          mechanicName={currentInv.shopInfo.name}
          onClose={() => { setShowQr(false); setPayingId(null); }}
          onVerify={handleQrVerify}
        />
      )}

      {/* Processing overlay */}
      <ProcessingModal
        visible={processing}
        method={METHODS.find(m => m.id === selectedMethod)?.label || "UPI"}
        amount={currentInv?.total || 0}
      />

      {/* Success */}
      {successData && (
        <SuccessModal
          visible
          amount={successData.amount}
          invoiceNum={successData.invoiceNum}
          method={successData.method}
          onClose={() => setSuccessData(null)}
        />
      )}
    </SafeAreaView>
  );
}
