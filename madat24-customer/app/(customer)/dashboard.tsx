import React, { useRef, useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, Animated,
  Modal, TextInput, Image, Alert, Platform, Linking,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { PulseDot, SectionHeader, useTheme } from "~/components/ui";
import { FONTS, SERVICES, STATUS_CFG } from "~/constants";
import { useAuthStore, useCustomerStore, useNotifStore, useChatStore, useMechanicStore } from "~/stores";
import { joinJobRoom, leaveJobRoom, useSocket } from "~/hooks/useSocket";
import type { CustomerJob, MediaItem, ChatMessage } from "~/types";
import { TrackingMap } from "~/components/shared/TrackingMap";
import { PhotoStrip, selectAndUploadPhoto } from "~/components/shared/PhotoPicker";
import { showToast } from "~/components/ui/Toast";
import { AnimatedNumber } from "~/components/ui/AnimatedNumber";
import { PressableScale } from "~/components/ui/PressableScale";
import { apiGetMyJobs } from "~/lib/api";

// ── Workflow track ────────────────────────────────────────────────
const STEPS = [
  { id: "pending",      label: "Sent",     icon: "Send"        },
  { id: "accepted",     label: "Accepted", icon: "UserCheck"   },
  { id: "in-progress",  label: "Working",  icon: "Wrench"      },
  { id: "completed",    label: "Done",     icon: "CheckCircle" },
];

function WorkflowTrack({ status }: { status: string }) {
  const C = useTheme();
  const order = STEPS.map(s => s.id);
  const cur   = Math.max(0, order.indexOf(status));
  const activeColor = STATUS_CFG[status]?.color || C.primary;
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lineAnim, { toValue: 1, duration: 800, delay: 100, useNativeDriver: false }).start();
  }, [status]);

  const pct = cur === 0 ? "5%" : cur === 1 ? "38%" : cur === 2 ? "70%" : "100%";

  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
      <View style={{ position: "absolute", top: 30, left: 26, right: 26, height: 3, backgroundColor: C.border, borderRadius: 2 }} />
      <Animated.View style={{ position: "absolute", top: 30, left: 26, height: 3, borderRadius: 2, backgroundColor: activeColor, width: lineAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", pct] }) }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {STEPS.map((step, i) => {
          const done   = cur > i;
          const active = order[i] === status || (status === "pending" && i === 0);
          const col    = done ? C.green : active ? activeColor : C.text3;
          return (
            <View key={step.id} style={{ alignItems: "center", flex: 1 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: done ? C.greenDim : active ? activeColor + "25" : C.bg2, borderWidth: active ? 2.5 : done ? 2 : 1, borderColor: col, alignItems: "center", justifyContent: "center", marginBottom: 8, shadowColor: active ? col : "transparent", shadowOffset: { width: 0, height: 0 }, shadowOpacity: active ? 0.5 : 0, shadowRadius: 8, elevation: active ? 4 : 0 }}>
                {done ? <Text style={{ color: C.green, fontSize: 16 }}>✓</Text> : <Icon name={step.icon as any} size={16} color={col} />}
              </View>
              <Text style={{ color: done ? C.green : active ? col : C.text3, fontFamily: active || done ? FONTS.bold : FONTS.regular, fontSize: 9, textAlign: "center" }}>{step.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}


// ── Chat modal ────────────────────────────────────────────────────
function ChatModal({ visible, jobId, mechanicName, onClose }: { visible: boolean; jobId: string; mechanicName: string; onClose: () => void }) {
  const C = useTheme();
  const { messages, sendMessage, setMessages } = useChatStore();
  const { user } = useAuthStore();
  const [text, setText] = useState("");
  const scroll = useRef<ScrollView>(null);
  const msgs = messages[jobId] || [];

  useEffect(() => {
    if (visible && msgs.length === 0) {
      setMessages(jobId, [
        { id: "c1", jobId, senderId: "mech", senderName: mechanicName, senderRole: "mechanic", text: "Hello! I've accepted your request. On my way, will be there in ~15 minutes.", createdAt: new Date(Date.now() - 300000).toISOString(), read: true },
      ]);
    }
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 200);
  }, [visible]);

  const send = () => {
    if (!text.trim()) return;
    sendMessage(jobId, { id: `m-${Date.now()}`, jobId, senderId: user?.id || "cust", senderName: user?.name || "You", senderRole: "customer", text: text.trim(), createdAt: new Date().toISOString(), read: false });
    setText("");
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable onPress={onClose} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bg1, alignItems: "center", justifyContent: "center" }}>
            <Icon name="ArrowLeft" size={20} color={C.text2} />
          </Pressable>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
            <Icon name="Wrench" size={16} color={C.primary} />
          </View>
          <View>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Chat — {mechanicName}</Text>
            <Text style={{ color: C.green, fontFamily: FONTS.regular, fontSize: 12 }}>Active job</Text>
          </View>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
          {msgs.map((m: ChatMessage, i: number) => {
            const isMe = m.senderRole === "customer";
            return (
              <View key={i} style={{ flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                {!isMe && <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}><Icon name="Wrench" size={13} color={C.primary} /></View>}
                <View style={{ maxWidth: "72%", backgroundColor: isMe ? C.primary : C.card, borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4, padding: 12 }}>
                  <Text style={{ color: "white", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
                  <Text style={{ color: "rgba(255,255,255,0.6)", fontFamily: FONTS.regular, fontSize: 10, marginTop: 4, textAlign: isMe ? "right" : "left" }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg1 }}>
          <TextInput value={text} onChangeText={setText} placeholder="Type a message..." placeholderTextColor={C.text3} style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 }} onSubmitEditing={send} />
          <Pressable onPress={send} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="Send" size={18} color="white" />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Review modal (ONLY after payment) ────────────────────────────
function ReviewModal({ visible, jobId, mechanicName, onClose }: { visible: boolean; jobId: string; mechanicName: string; onClose: () => void }) {
  const C = useTheme();
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { addReview: customerAddReview } = useCustomerStore();
  const { addReview: mechanicAddReview } = useMechanicStore();
  const { user } = useAuthStore();

  const TAGS = ["Quick Response", "Professional", "Fair Price", "Knowledgeable", "Friendly", "On Time"];

  const handleSubmit = async () => {
    if (rating === 0) { Alert.alert("Required", "Please give a star rating"); return; }
    setSubmitting(true);

    // Persist to backend — recomputes mechanic rating, notifies mechanic via push + socket
    let backendOk = false;
    try {
      const { apiSubmitReview } = await import("~/lib/api");
      await apiSubmitReview(jobId, { rating, review: review.trim(), tags: selected });
      backendOk = true;
    } catch (e: any) {
      // Fall through — still update local store so the customer's UI reflects their action
      console.warn("[review] backend save failed", e?.message);
    }

    // Local state — keeps the customer's history view in sync immediately
    const rev = {
      id: `rev-${Date.now()}`,
      jobId, customerId: user?.id || "cust", mechanicId: "mech",
      customerName: user?.name || "Customer",
      rating, review: review.trim(),
      tags: selected,
      createdAt: new Date().toISOString(),
    };
    customerAddReview(jobId, rating, review, selected);
    mechanicAddReview(rev);

    setSubmitting(false);
    onClose();
    Alert.alert(
      backendOk ? "Review Submitted! ⭐" : "Saved Locally ⚠️",
      backendOk
        ? "Thanks! Your rating helps the mechanic and other customers."
        : "Couldn't reach the server — your review will sync when you're back online."
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000000CC", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.bg1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 }} />
          <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 22, marginBottom: 4 }}>Rate Your Experience</Text>
          <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, marginBottom: 20 }}>How was the service by {mechanicName}?</Text>

          {/* Stars */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable key={star} onPress={() => setRating(star)}>
                <Text style={{ fontSize: 40 }}>{star <= rating ? "⭐" : "☆"}</Text>
              </Pressable>
            ))}
          </View>

          {/* Tags */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {TAGS.map(tag => (
              <Pressable key={tag} onPress={() => setSelected(p => p.includes(tag) ? p.filter(t => t !== tag) : [...p, tag])} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: selected.includes(tag) ? C.primary + "20" : C.bg, borderWidth: 1.5, borderColor: selected.includes(tag) ? C.primary : C.border }}>
                <Text style={{ color: selected.includes(tag) ? C.primary : C.text2, fontFamily: selected.includes(tag) ? FONTS.semibold : FONTS.regular, fontSize: 12 }}>{tag}</Text>
              </Pressable>
            ))}
          </View>

          {/* Review text */}
          <TextInput value={review} onChangeText={setReview} placeholder="Write a review (optional)..." placeholderTextColor={C.text3} multiline numberOfLines={3} style={{ backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, color: C.text1, fontFamily: FONTS.regular, fontSize: 14, padding: 14, minHeight: 80, textAlignVertical: "top", marginBottom: 16 }} />

          <Pressable onPress={handleSubmit} disabled={submitting} style={{ borderRadius: 14, overflow: "hidden" }}>
            <LinearGradient colors={[C.yellow, "#D97706"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
              <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 15 }}>{submitting ? "Submitting..." : "Submit Review"}</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onClose} style={{ alignItems: "center", marginTop: 14 }}>
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── Payment modal ─────────────────────────────────────────────────
function PaymentModal({ visible, job, onClose }: { visible: boolean; job: CustomerJob | null; onClose: () => void }) {
  const C = useTheme();
  const [step, setStep] = useState<"invoice" | "method" | "qr" | "success">("invoice");
  const [paying, setPaying] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [creditElig, setCreditElig] = useState<import("~/lib/api").CreditEligibility | null>(null);
  const { payInvoice } = useCustomerStore();
  const { addNotification } = useNotifStore();
  const { user } = useAuthStore();

  // Fetch credit eligibility when modal becomes visible
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const { apiCreditEligibility } = await import("~/lib/api");
        const elig = await apiCreditEligibility();
        setCreditElig(elig);
      } catch { setCreditElig(null); }
    })();
  }, [visible]);

  if (!job?.invoice) return null;
  const inv = job.invoice;

  // ── UPI deep-link builder ───────────────────────────────────────
  // Mechanic's UPI ID lives on the invoice payload (added by backend).
  // Falls back to phone-based Paytm UPI if not set, so the QR is still scannable.
  const mechanicPhone = (inv.shopInfo as any)?.phone || job.mechanic?.phone || "";
  const phoneDigits   = mechanicPhone.replace(/\D/g, "").slice(-10);
  const upiId         = (inv.shopInfo as any)?.upiId
    || (phoneDigits.length === 10 ? `${phoneDigits}@paytm` : "demo@upi");
  const payeeName     = encodeURIComponent(inv.shopInfo?.name || "Madat24 Mechanic");
  const note          = encodeURIComponent(`Madat24 ${inv.invoiceNumber}`);
  const amount        = inv.total.toFixed(2);
  const upiDeepLink   = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount}&cu=INR&tn=${note}`;

  const handlePay = async (method: string) => {
    setPaying(true);
    try {
      // Persist server-side so the mechanic gets the live "payment_received" event
      const { apiTapToPay } = await import("~/lib/api");
      await apiTapToPay(job.id, method);
    } catch {
      // Backend offline — still allow local mark-as-paid for dev flow
      await new Promise(r => setTimeout(r, 600));
    }
    payInvoice(job.id, method);
    if (user) {
      addNotification({ id: `notif-pay-${Date.now()}`, userId: user.id, type: "payment_received", title: "Payment Successful! 💚", message: `₹${inv.total.toFixed(2)} paid via ${method}`, read: false, createdAt: new Date().toISOString() });
    }
    showToast(`Paid ₹${inv.total.toFixed(0)} via ${method}`, "success");
    setPaying(false);
    setStep("success");
  };

  const handleCredit = () => {
    Alert.alert(
      "Use One-Time Credit?",
      `You'll be able to leave now and clear ₹${inv.total.toFixed(2)} later. This is your one-time credit — you cannot use it again until this is settled.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Use Credit",
          style: "default",
          onPress: async () => {
            setPaying(true);
            try {
              const { apiUseCredit } = await import("~/lib/api");
              await apiUseCredit(job.id);
              showToast(`Credit applied — ₹${inv.total.toFixed(0)} due later`, "success");
              if (user) {
                addNotification({ id: `notif-credit-${Date.now()}`, userId: user.id, type: "credit_taken" as any, title: "Credit Applied 📒", message: `₹${inv.total.toFixed(2)} on credit. Settle later from Invoices.`, read: false, createdAt: new Date().toISOString() });
              }
              onClose();
            } catch (e: any) {
              showToast(e?.message || "Couldn't apply credit", "error");
            } finally { setPaying(false); }
          },
        },
      ]
    );
  };

  if (showReview) return (
    <ReviewModal visible={true} jobId={job.id} mechanicName={job.mechanic?.name || "Mechanic"} onClose={() => { setShowReview(false); onClose(); }} />
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.overlay, justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: C.bg1, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: 20 }} />

          {step === "success" ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Text style={{ fontSize: 60, marginBottom: 16 }}>✅</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 24, marginBottom: 8 }}>Payment Successful!</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", marginBottom: 24 }}>₹{inv.total.toFixed(2)} paid successfully</Text>
              <Pressable onPress={() => setShowReview(true)} style={{ width: "100%", backgroundColor: C.yellow + "20", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 10, borderWidth: 1.5, borderColor: C.yellow + "50" }}>
                <Text style={{ color: C.yellow, fontFamily: FONTS.bold, fontSize: 15 }}>⭐ Rate Your Experience</Text>
              </Pressable>
              <Pressable onPress={onClose} style={{ width: "100%", borderRadius: 14, overflow: "hidden" }}>
                <LinearGradient colors={[C.green, C.greenDark]} style={{ paddingVertical: 16, alignItems: "center" }}>
                  <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 15 }}>Done</Text>
                </LinearGradient>
              </Pressable>
            </View>

          ) : step === "method" ? (
            <View>
              <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 22, marginBottom: 14 }}>Pay ₹{inv.total.toFixed(2)}</Text>

              {/* Outstanding-credit warning */}
              {creditElig?.outstandingCredit && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#F59E0B14", borderWidth: 1, borderColor: "#F59E0B40", marginBottom: 14 }}>
                  <Text style={{ fontSize: 18 }}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#F59E0B", fontFamily: FONTS.bold, fontSize: 12 }}>Outstanding credit: {creditElig.outstandingCredit.invoiceNumber}</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>₹{creditElig.outstandingCredit.total.toFixed(0)} pending — credit option will unlock once cleared.</Text>
                  </View>
                </View>
              )}

              {[
                { method: "UPI",        icon: "QrCode",     label: "Scan UPI QR Code",       sub: "PhonePe · GPay · Paytm · BHIM", color: C.green   },
                { method: "Card",       icon: "CreditCard", label: "Debit / Credit Card",    sub: "Visa, Mastercard, Rupay",       color: C.primary },
                { method: "NetBanking", icon: "Landmark",   label: "Net Banking",            sub: "All major banks",                color: C.purple },
                { method: "Cash",       icon: "Banknote",   label: "Pay Cash to Mechanic",   sub: "No transaction fees",            color: C.yellow },
              ].map(opt => (
                <Pressable
                  key={opt.method}
                  onPress={() => opt.method === "UPI" ? setStep("qr") : handlePay(opt.method)}
                  disabled={paying}
                  style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: C.bg, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: opt.method === "UPI" ? C.green + "55" : C.border }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: opt.color + "20", alignItems: "center", justifyContent: "center" }}>
                    <Icon name={opt.icon as any} size={22} color={opt.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 14 }}>{opt.label}</Text>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{opt.sub}</Text>
                  </View>
                  <Icon name="ChevronRight" size={18} color={C.text3} />
                </Pressable>
              ))}

              {/* ── One-time credit option ──────────────────────────── */}
              <Pressable
                onPress={() => {
                  if (creditElig?.eligible) handleCredit();
                  else showToast(creditElig?.reason || "Credit not available yet", "info");
                }}
                disabled={paying}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  backgroundColor: creditElig?.eligible ? "#2563EB10" : C.bg,
                  borderRadius: 16, padding: 16, marginBottom: 10,
                  borderWidth: 1, borderColor: creditElig?.eligible ? "#2563EB55" : C.border,
                  opacity: creditElig?.eligible ? 1 : 0.55,
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "#2563EB22", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="Clock" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 14 }}>Pay Later (Credit)</Text>
                    <View style={{ backgroundColor: "#2563EB22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                      <Text style={{ color: "#2563EB", fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 0.6 }}>ONE-TIME</Text>
                    </View>
                  </View>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 1 }}>
                    {creditElig?.eligible
                      ? "Leave now, settle invoice later"
                      : (creditElig?.reason || "Loading eligibility…")}
                  </Text>
                </View>
                <Icon name={creditElig?.eligible ? "ChevronRight" : "Lock"} size={18} color={creditElig?.eligible ? C.text3 : C.text3} />
              </Pressable>

              <Pressable onPress={() => setStep("invoice")} style={{ alignItems: "center", marginTop: 6 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>← Back to Invoice</Text>
              </Pressable>
            </View>

          ) : step === "qr" ? (
            <View>
              {/* Header */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <View>
                  <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 20 }}>Scan & Pay</Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 2 }}>{inv.invoiceNumber}</Text>
                </View>
                <View style={{ backgroundColor: C.green + "20", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: C.green + "50" }}>
                  <Text style={{ color: C.green, fontFamily: FONTS.black, fontSize: 16 }}>₹{inv.total.toFixed(2)}</Text>
                </View>
              </View>

              {/* QR card */}
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: 22, padding: 22, alignItems: "center", marginBottom: 14, borderWidth: 2, borderColor: C.green + "40" }}>
                {/* Brand strip on top */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}>
                  <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: "#0F0F0F", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#F97316", fontFamily: FONTS.black, fontSize: 14 }}>M</Text>
                  </View>
                  <Text style={{ fontFamily: FONTS.black, fontSize: 13, color: "#0F0F0F" }}>
                    <Text style={{ color: "#F97316" }}>MADAT</Text><Text style={{ color: "#2563EB" }}>24</Text><Text style={{ color: "#F97316", fontSize: 10 }}>/7</Text>
                  </Text>
                </View>

                <QRCode
                  value={upiDeepLink}
                  size={210}
                  color="#0A0A0A"
                  backgroundColor="#FFFFFF"
                />

                <Text style={{ color: "#0A0A0A", fontFamily: FONTS.bold, fontSize: 13, marginTop: 14 }}>
                  {inv.shopInfo?.name || "Mechanic"}
                </Text>
                <Text style={{ color: "#666666", fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                  {upiId}
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                  {["PhonePe", "GPay", "Paytm", "BHIM"].map(app => (
                    <View key={app} style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: "#F0F4FA" }}>
                      <Text style={{ color: "#444", fontFamily: FONTS.medium, fontSize: 9 }}>{app}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Instructions */}
              <View style={{ backgroundColor: C.bg, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
                {[
                  "Open any UPI app on your phone",
                  "Tap 'Scan QR' and point camera here",
                  "Confirm amount & complete payment",
                  "Tap 'I've Paid' below",
                ].map((line, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: i === 3 ? 0 : 6 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.green + "20", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: C.green, fontFamily: FONTS.black, fontSize: 10 }}>{i + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>{line}</Text>
                  </View>
                ))}
              </View>

              {/* Open UPI app on this device (mobile only) */}
              <Pressable
                onPress={() => Linking.openURL(upiDeepLink).catch(() => showToast("No UPI app found on this device", "error"))}
                style={{ borderRadius: 14, overflow: "hidden", marginBottom: 10 }}
              >
                <View style={{ paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border }}>
                  <Icon name="Smartphone" size={16} color={C.text2} />
                  <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 13 }}>Open UPI App on this Phone</Text>
                </View>
              </Pressable>

              {/* I've Paid → mark invoice paid */}
              <Pressable
                onPress={() => handlePay("UPI")}
                disabled={paying}
                style={{ borderRadius: 14, overflow: "hidden" }}
              >
                <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}>
                  <Icon name="CheckCircle" size={18} color="white" />
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 15 }}>{paying ? "Confirming…" : "I've Paid"}</Text>
                </LinearGradient>
              </Pressable>

              <Pressable onPress={() => setStep("method")} style={{ alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>← Choose Different Method</Text>
              </Pressable>
            </View>

          ) : (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 22 }}>Invoice</Text>
                <View style={{ backgroundColor: C.yellowDim, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                  <Text style={{ color: C.yellow, fontFamily: FONTS.bold, fontSize: 12 }}>{inv.invoiceNumber}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: C.bg, borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 12, marginBottom: 10 }}>FROM: {inv.shopInfo.name}</Text>
                {inv.lineItems.map((item, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13, flex: 1 }}>{item.description} ×{item.quantity}</Text>
                    <Text style={{ color: C.text1, fontFamily: FONTS.medium, fontSize: 13 }}>₹{item.total.toFixed(0)}</Text>
                  </View>
                ))}
                <View style={{ height: 1, backgroundColor: C.border, marginVertical: 10 }} />
                {[["Subtotal", `₹${inv.subtotal.toFixed(2)}`], ["GST 18%", `₹${inv.tax.toFixed(2)}`]].map(([l, v]) => (
                  <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>{l}</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13 }}>{v}</Text>
                  </View>
                ))}
                <View style={{ backgroundColor: C.primaryDim, borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 17 }}>Total Due</Text>
                  <Text style={{ color: C.primary, fontFamily: FONTS.black, fontSize: 24 }}>₹{inv.total.toFixed(2)}</Text>
                </View>
              </View>
              <Pressable onPress={() => setStep("method")} style={{ borderRadius: 16, overflow: "hidden" }}>
                <LinearGradient colors={[C.primary, C.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                  <Icon name="CreditCard" size={20} color="white" />
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Pay ₹{inv.total.toFixed(2)}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={onClose} style={{ alignItems: "center", marginTop: 12 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Pay later</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Active Job Card ───────────────────────────────────────────────
const EMOJIS: Record<string, string> = {
  "tyre-puncture": "🔧", "fuel-delivery": "⛽", "engine-repair": "⚙️",
  "brake-repair": "🛑", "battery-jump-start": "⚡", "towing-services": "🚛",
  "oil-change": "🛢️", "ac-repair": "❄️",
};

const distanceKm = (a?: { lat: number; lng: number }, b?: { lat: number; lng: number }) => {
  if (!a || !b) return undefined;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))).toFixed(2));
};

const etaFromDistance = (km?: number) =>
  typeof km === "number" ? `${Math.max(2, Math.round(km * 4))} min` : undefined;

function ActiveJobCard({ job }: { job: CustomerJob }) {
  const C = useTheme();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const cfg = STATUS_CFG[job.status] || STATUS_CFG.pending;
  const [chatOpen, setChatOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [tracking, setTracking] = useState<{
    coords?: { lat: number; lng: number };
    distance?: number;
    eta?: string;
  }>({
    coords: job.mechanic?.coordinates,
    distance: distanceKm(job.mechanic?.coordinates, job.location?.coordinates),
    eta: job.estimatedArrival || etaFromDistance(distanceKm(job.mechanic?.coordinates, job.location?.coordinates)),
  });
  const { addCustomerMedia } = useCustomerStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    if (["pending", "in-progress"].includes(job.status)) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])).start();
      // Glowing shadow pulse — makes pending/active jobs catch the eye
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.2, duration: 1500, useNativeDriver: true }),
      ])).start();
    }
  }, [job.status]);

  useEffect(() => {
    setTracking(prev => ({
      coords: prev.coords || job.mechanic?.coordinates,
      distance: prev.distance ?? distanceKm(job.mechanic?.coordinates, job.location?.coordinates),
      eta: prev.eta || job.estimatedArrival || etaFromDistance(distanceKm(job.mechanic?.coordinates, job.location?.coordinates)),
    }));
  }, [job.mechanic?.coordinates?.lat, job.mechanic?.coordinates?.lng, job.estimatedArrival]);

  useEffect(() => {
    if (!socket || !["accepted", "in-progress"].includes(job.status)) return;
    joinJobRoom(socket, job.id);
    const onMechanicLocation = (payload: any) => {
      if (payload?.jobId && payload.jobId !== job.id) return;
      if (job.mechanicId && payload?.mechanicId && payload.mechanicId !== job.mechanicId) return;
      const lat = Number(payload?.latitude);
      const lng = Number(payload?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const nextCoords = { lat, lng };
      const fallbackDistance = distanceKm(nextCoords, job.location?.coordinates);
      setTracking({
        coords: nextCoords,
        distance: typeof payload.distance === "number" ? payload.distance : fallbackDistance,
        eta: payload.eta || etaFromDistance(fallbackDistance),
      });
    };
    socket.on("mechanic_location", onMechanicLocation);
    return () => {
      socket.off("mechanic_location", onMechanicLocation);
      leaveJobRoom(socket, job.id);
    };
  }, [socket, job.id, job.status, job.mechanicId]);

  const canChat     = ["accepted", "in-progress"].includes(job.status);
  const canAddPhoto = job.status === "pending";
  const showPay     = job.status === "completed" && job.invoice?.paymentStatus === "pending";
  const isPaid      = job.invoice?.paymentStatus === "paid";

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 16, shadowColor: cfg.glow || cfg.color, shadowOffset: { width: 0, height: 8 }, shadowOpacity: glowAnim as any, shadowRadius: 22, elevation: 8 }}>
      <View style={{ backgroundColor: C.card, borderRadius: 22, borderWidth: 1.5, borderColor: cfg.color + "45", overflow: "hidden" }}>
        {/* Status bar */}
        <LinearGradient colors={[cfg.color + "25", cfg.color + "08"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: 16, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot color={cfg.color} size={4} />
            <Text style={{ color: cfg.color, fontFamily: FONTS.bold, fontSize: 11, letterSpacing: 1.2 }}>{cfg.label.toUpperCase()}</Text>
          </View>
          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>
            {formatDistanceToNow(new Date(job.timestamps.requested), { addSuffix: true })}
          </Text>
        </LinearGradient>

        <View style={{ padding: 16 }}>
          {/* Service header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <View style={{ width: 54, height: 54, borderRadius: 15, backgroundColor: cfg.color + "18", borderWidth: 1, borderColor: cfg.color + "30", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26 }}>{EMOJIS[job.serviceType] || "🔧"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 18, textTransform: "capitalize" }}>{job.serviceType.replace(/-/g, " ")}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                <Icon name="MapPin" size={12} color={C.primary} />
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }} numberOfLines={1}>{job.location.address}, {job.location.city}</Text>
              </View>
            </View>
          </View>

          {/* Workflow */}
          <View style={{ backgroundColor: C.bg1, borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <Icon name="GitBranch" size={12} color={C.text3} />
              <Text style={{ color: C.text3, fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 0.8 }}>JOB WORKFLOW</Text>
            </View>
            <WorkflowTrack status={job.status} />
          </View>

          {/* Mechanic info */}
          {/* Live tracking map — shown when mechanic is on the way or working */}
          {["accepted", "in-progress"].includes(job.status) && !!job.mechanic && (
            <TrackingMap
              customerName={user?.name ?? "You"}
              mechanicName={job.mechanic?.name ?? "Mechanic"}
              mechanicShop={job.mechanic?.shopName ?? ""}
              customerCoords={job.location?.coordinates ?? undefined}
              mechanicCoords={tracking.coords}
              distance={tracking.distance}
              eta={tracking.eta || "Calculating"}
              status={job.status}
              viewerRole="customer"
            />
          )}

          {job.mechanic && ["accepted", "in-progress", "completed"].includes(job.status) && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bg1, borderRadius: 14, padding: 13, marginBottom: 12, borderWidth: 1, borderColor: C.border }}>
              <LinearGradient colors={[C.primary, C.primaryDark]} style={{ width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                <Icon name="User" size={20} color="white" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 14 }}>{job.mechanic.name}</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>{job.mechanic.shopName}</Text>
                {job.mechanic.rating > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Text style={{ color: C.yellow, fontSize: 11 }}>⭐</Text>
                    <Text style={{ color: C.yellow, fontFamily: FONTS.bold, fontSize: 11 }}>{job.mechanic.rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
              <View style={{ gap: 6 }}>
                <Pressable style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.greenDim, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="Phone" size={16} color={C.green} />
                </Pressable>
                {canChat && (
                  <Pressable onPress={() => setChatOpen(true)} style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="MessageCircle" size={16} color={C.primary} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Status hints */}
          {job.status === "pending" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.yellow + "15", borderRadius: 12, padding: 11, marginBottom: 12, borderWidth: 1, borderColor: C.yellow + "30" }}>
              <PulseDot color={C.yellow} size={4} />
              <Text style={{ color: C.yellow, fontFamily: FONTS.medium, fontSize: 13, flex: 1 }}>Searching for mechanics nearby...</Text>
            </View>
          )}
          {job.status === "accepted" && job.estimatedArrival && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primaryDim, borderRadius: 12, padding: 11, marginBottom: 12, borderWidth: 1, borderColor: C.primary + "30" }}>
              <Icon name="Navigation" size={14} color={C.primary} />
              <Text style={{ color: C.primary, fontFamily: FONTS.medium, fontSize: 13 }}>Mechanic on the way — ETA {job.estimatedArrival}</Text>
            </View>
          )}
          {job.status === "in-progress" && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.orange + "15", borderRadius: 12, padding: 11, marginBottom: 12, borderWidth: 1, borderColor: C.orange + "30" }}>
              <Icon name="Wrench" size={14} color={C.orange} />
              <Text style={{ color: C.orange, fontFamily: FONTS.medium, fontSize: 13, flex: 1 }}>Mechanic is actively working on your vehicle</Text>
              <PulseDot color={C.orange} size={4} />
            </View>
          )}

          {/* Customer photos (only in pending) */}
          <PhotoStrip
            photos={job.customerMedia}
            label="📷 Your vehicle photos"
            jobId={job.id}
            category="customer"
            onAdd={canAddPhoto ? (localUri, remoteUrl) => {
              addCustomerMedia(job.id, {
                id: `cm-${Date.now()}`, type: "photo",
                uri: remoteUrl || localUri,
                uploadedAt: new Date().toISOString(), uploadedBy: "customer",
              });
            } : undefined}
            readonly={!canAddPhoto}
          />

          {/* Progress photos from mechanic */}
          {(job.progressMedia || []).length > 0 && (
            <PhotoStrip photos={job.progressMedia || []} label="🔧 Progress photos from mechanic" readonly />
          )}

          {/* Pay CTA — ONLY after completion */}
          {showPay && (
            <PressableScale haptic="success" onPress={() => setPayOpen(true)} style={{ borderRadius: 16, overflow: "hidden", marginTop: 4 }}>
              <LinearGradient colors={[C.primary, C.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 15 }}>Service Complete — Pay Now</Text>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontFamily: FONTS.regular, fontSize: 12 }}>{job.invoice?.invoiceNumber} • ₹{job.invoice?.total.toFixed(2)}</Text>
                </View>
                <View style={{ backgroundColor: "#ffffff30", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 14 }}>Pay ₹{job.invoice?.total.toFixed(0)}</Text>
                </View>
              </LinearGradient>
            </PressableScale>
          )}

          {isPaid && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.greenDim, borderRadius: 12, padding: 11, borderWidth: 1, borderColor: C.green + "40" }}>
              <Icon name="CheckCircle" size={15} color={C.green} />
              <Text style={{ color: C.green, fontFamily: FONTS.semibold, fontSize: 13 }}>
                Paid ✓ {job.invoice?.paymentMethod}
                {job.rating ? `  •  ⭐ ${job.rating}/5 reviewed` : ""}
              </Text>
            </View>
          )}
        </View>
      </View>

      {canChat && job.mechanic && (
        <ChatModal visible={chatOpen} jobId={job.id} mechanicName={job.mechanic.name} onClose={() => setChatOpen(false)} />
      )}
      <PaymentModal visible={payOpen} job={job} onClose={() => setPayOpen(false)} />
    </Animated.View>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────
export default function CustomerDashboard() {
  const C = useTheme();
  const { user } = useAuthStore();
  const { jobs, syncJobsFromBackend } = useCustomerStore();
  const { unreadCount } = useNotifStore();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const { updateJobStatus, updateJobMechanic } = useCustomerStore();
  const active    = jobs.filter(j => ["pending", "accepted", "in-progress"].includes(j.status));
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

  const { socket } = useSocket();
  React.useEffect(() => {
    if (!socket) return;
    socket.on("job_accepted", ({ jobId, mechanic }: any) => {
      updateJobStatus(jobId, "accepted");
      if (mechanic) updateJobMechanic(jobId, mechanic);
      refreshJobs();
      showToast(`${mechanic?.name || "A mechanic"} accepted your request`, "success");
    });
    socket.on("job_started", ({ jobId }: any) => {
      updateJobStatus(jobId, "in-progress");
      refreshJobs();
      showToast("Mechanic started working", "info");
    });
    socket.on("job_completed", ({ jobId }: any) => {
      updateJobStatus(jobId, "completed");
      refreshJobs();
      showToast("Service complete — invoice ready", "success");
    });
    socket.on("job_cancelled", ({ reason }: any) => {
      refreshJobs();
      showToast(reason === "expired" ? "Request expired — no mechanic responded" : "Request cancelled", "error");
    });
    return () => {
      socket.off("job_accepted"); socket.off("job_started");
      socket.off("job_completed"); socket.off("job_cancelled");
    };
  }, [socket, refreshJobs, updateJobMechanic, updateJobStatus]);
  const completed = jobs.filter(j => j.status === "completed");
  const cancelled = jobs.filter(j => j.status === "cancelled");
  const pendingPay= completed.filter(j => j.invoice?.paymentStatus === "pending");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Header ──────────────────────────────────────────── */}
        <LinearGradient colors={[C.isDark ? "#0D1219" : "#EEF4FF", C.bg]} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Top bar: Logo + Bell */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              {/* MADAT24 Logo */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: "#0F0F0F",
                  borderWidth: 1.5, borderColor: "#1E1E1E",
                  alignItems: "center", justifyContent: "center",
                  shadowColor: "#F97316", shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
                }}>
                  <Text style={{ color: "#F97316", fontFamily: FONTS.black, fontSize: 22, letterSpacing: -1 }}>M</Text>
                  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2.5, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: "#2563EB" }} />
                </View>
                <View>
                  <Text style={{ fontFamily: FONTS.black, fontSize: 18, letterSpacing: -0.5 }} numberOfLines={1}>
                    <Text style={{ color: "#F97316" }}>MADAT</Text><Text style={{ color: "#2563EB" }}>24</Text><Text style={{ color: "#F97316", fontSize: 13 }}>/7</Text>
                  </Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, letterSpacing: 1.5 }}>CUSTOMER</Text>
                </View>
              </View>

              {/* Right: Greeting + Bell */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 11 }}>Welcome back,</Text>
                  <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>{user?.name?.split(" ")[0] || "there"} 👋</Text>
                </View>
                <Pressable onPress={() => router.push("/(shared)/notifications")} style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="Bell" size={20} color={unreadCount > 0 ? "#F97316" : C.text2} />
                  {unreadCount > 0 && (
                    <View style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 8.5, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 2, borderColor: C.bg }}>
                      <Text style={{ color: "white", fontSize: 8, fontFamily: FONTS.bold }}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Status line */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: active.length > 0 ? "#22C55E" : C.text3 }} />
              <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>
                {active.length > 0 ? `${active.length} active job${active.length > 1 ? "s" : ""} in progress` : "No active jobs — need vehicle help?"}
              </Text>
            </View>

            {/* Industrial chrome strip — service-area indicator */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.isDark ? "#0F1620" : "#E6EEFC", borderWidth: 1, borderColor: "#2563EB33", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                <Text style={{ fontSize: 11 }}>📡</Text>
                <Text style={{ color: "#2563EB", fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.8 }}>SERVICE ACTIVE</Text>
              </View>
              {/* Chrome segmentation marks */}
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 3, height: 10 }}>
                {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
                  <View key={i} style={{ flex: 1, height: i % 3 === 0 ? 6 : 2.5, borderRadius: 1, backgroundColor: i % 3 === 0 ? "#F9731633" : "#2A2A2A" }} />
                ))}
              </View>
              <Text style={{ color: C.text3, fontFamily: FONTS.bold, fontSize: 9, letterSpacing: 1 }}>24/7</Text>
            </View>

            {/* Stats */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { l: "Active",    v: active.length,    color: "#F97316", e: "⚡" },
                { l: "Completed", v: completed.length, color: "#22C55E", e: "✅" },
                { l: "Cancelled", v: cancelled.length, color: "#EF4444", e: "✖"  },
                { l: "Total",     v: jobs.length,      color: "#2563EB", e: "📋" },
              ].map((s, i) => (
                <PressableScale key={i} onPress={() => router.push("/(customer)/history")} style={{ flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 11, alignItems: "center", borderWidth: 1, borderColor: s.color + "22" }}>
                  <Text style={{ fontSize: 15, marginBottom: 3 }}>{s.e}</Text>
                  <AnimatedNumber value={s.v} style={{ color: s.color, fontFamily: FONTS.black, fontSize: 20 }} />
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 9, textAlign: "center" }}>{s.l}</Text>
                </PressableScale>
              ))}
            </View>
          </Animated.View>
        </LinearGradient>

        <Animated.View style={{ opacity: fadeAnim, paddingHorizontal: 16, paddingTop: 20 }}>

          {/* Pending payment alert */}
          {pendingPay.length > 0 && (
            <Pressable onPress={() => router.push("/(customer)/invoices")} style={{ marginBottom: 18 }}>
              <LinearGradient colors={[C.isDark ? "#1E1400" : "#FFF8E8", C.isDark ? "#120E00" : "#FFF0D0"]} style={{ borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: C.yellow + "50" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 28 }}>💳</Text>
                  <View>
                    <Text style={{ color: C.yellow, fontFamily: FONTS.bold, fontSize: 14 }}>Payment Due</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>{pendingPay.length} invoice{pendingPay.length > 1 ? "s" : ""} awaiting payment</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.yellow + "20", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                  <Text style={{ color: C.yellow, fontFamily: FONTS.bold, fontSize: 12 }}>Pay Now</Text>
                  <Icon name="ArrowRight" size={14} color={C.yellow} />
                </View>
              </LinearGradient>
            </Pressable>
          )}

          {/* Request CTA */}
          <PressableScale haptic="medium" onPress={() => router.push("/(customer)/request")} style={{ marginBottom: 12, borderRadius: 22, overflow: "hidden", shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 8 }}>
            <LinearGradient colors={[C.primary, C.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ padding: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}>
                <View style={{ backgroundColor: "#ffffff25", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 8 }}>
                  <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 1 }}>24/7 AVAILABLE</Text>
                </View>
                <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 22 }}>Need Assistance?</Text>
                <Text style={{ color: "rgba(255,255,255,0.8)", fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>Mechanics within 3km · 15-min response</Text>
              </View>
              <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: "#ffffff18", borderWidth: 1.5, borderColor: "#ffffff30", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 28 }}>⚡</Text>
              </View>
            </LinearGradient>
          </PressableScale>

          {/* AI Automobile Assistant CTA */}
          <PressableScale haptic="light" onPress={() => router.push("/(shared)/ai-assistant")} style={{ marginBottom: 24, borderRadius: 20, overflow: "hidden", borderWidth: 1.5, borderColor: "#2563EB55", backgroundColor: C.card }}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 14 }}>
              <View style={{ width: 50, height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#2563EB18", borderWidth: 1, borderColor: "#2563EB45" }}>
                <Text style={{ fontSize: 26 }}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 15 }}>AI Mechanic Helper</Text>
                  <View style={{ backgroundColor: "#2563EB22", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 }}>
                    <Text style={{ color: "#2563EB", fontFamily: FONTS.bold, fontSize: 8, letterSpacing: 0.6 }}>NEW</Text>
                  </View>
                </View>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17 }}>
                  Diagnose problems, see fix steps & cost — in seconds
                </Text>
              </View>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#2563EB18", alignItems: "center", justifyContent: "center" }}>
                <Icon name="ArrowRight" size={16} color="#2563EB" />
              </View>
            </View>
          </PressableScale>

          {/* Active jobs — empty state when zero */}
          {active.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <SectionHeader title="Active Jobs" action="History" onAction={() => router.push("/(customer)/history")} />
              {active.map(job => <ActiveJobCard key={job.id} job={job} />)}
            </View>
          ) : (
            <View style={{ alignItems: "center", backgroundColor: C.card, borderRadius: 20, padding: 32, marginBottom: 24, borderWidth: 1, borderColor: C.cardBorder }}>
              <Text style={{ fontSize: 52, marginBottom: 16 }}>🔧</Text>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 8, textAlign: "center" }}>No Active Jobs</Text>
              <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 20 }}>
                Tap "Need Assistance?" above to find mechanics near you. Your active jobs will appear here.
              </Text>
            </View>
          )}

          {/* Completed jobs needing payment */}
          {pendingPay.map(job => (
            <View key={job.id} style={{ marginBottom: 8 }}>
              <ActiveJobCard job={job} />
            </View>
          ))}

          {/* Services grid */}
          <SectionHeader title="Quick Request" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(SERVICES as readonly any[]).map((s: any, i: number) => (
              <Pressable key={i} onPress={() => router.push({ pathname: "/(customer)/request", params: { service: s.type } })} style={{ width: "22%", backgroundColor: C.card, borderRadius: 16, padding: 11, alignItems: "center", borderWidth: 1, borderColor: s.color + "30" }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: s.color + "18", alignItems: "center", justifyContent: "center", marginBottom: 7 }}>
                  <Text style={{ fontSize: 18 }}>{EMOJIS[s.type]}</Text>
                </View>
                <Text style={{ fontSize: 9, fontFamily: FONTS.medium, color: C.text2, textAlign: "center" }}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
