import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  Alert, Modal, Image, Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "~/lib/icons/Icon";
import { Card, PulseDot, JobTimeline, MediaThumb, useTheme } from "~/components/ui";
import { FONTS } from "~/constants";
import { useMechanicStore, useNotifStore, useChatStore, useAuthStore } from "~/stores";
import type { ActiveJob } from "~/stores";
import { TrackingMap } from "~/components/shared/TrackingMap";
import { PhotoStrip, selectAndUploadPhoto } from "~/components/shared/PhotoPicker";
import type { Invoice, MediaItem, ChatMessage } from "~/types";
import { formatDistanceToNow } from "date-fns";
import { useFocusEffect } from "expo-router";
import { apiArriveJob, apiCompleteJob, apiGetMechJobs, apiGetMessages, apiSendMessage, apiStartJob } from "~/lib/api";
import { joinJobRoom, leaveJobRoom, useSocket } from "~/hooks/useSocket";

// ── Photo fullscreen ──────────────────────────────────────────────
function PhotoFull({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "#000000EE", alignItems: "center", justifyContent: "center" }}>
        <Image source={{ uri }} style={{ width: "92%", height: 360, borderRadius: 18 }} resizeMode="contain" />
        <Pressable onPress={onClose} style={{ marginTop: 20, backgroundColor: "#1a1a2a", paddingHorizontal: 28, paddingVertical: 13, borderRadius: 22 }}>
          <Text style={{ color: "white", fontFamily: FONTS.semibold, fontSize: 14 }}>Close</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Media strip ───────────────────────────────────────────────────
function MediaStrip({ photos, label, onAdd, readonly = false, jobId, category = "progress" }: { photos: MediaItem[]; label: string; onAdd?: (localUri: string, remoteUrl?: string) => void; readonly?: boolean; jobId?: string; category?: "customer" | "progress" | "completion" }) {
  const C = useTheme();
  const [preview, setPreview] = useState<string | null>(null);
  const handleAdd = () => {
    if (!onAdd) return;
    selectAndUploadPhoto({
      jobId, category,
      onPicked: (localUri, remoteUrl) => onAdd(localUri, remoteUrl),
    });
  };
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 12 }}>{label}</Text>
        {!readonly && onAdd && (
          <Pressable onPress={handleAdd} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.primaryDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}>
            <Icon name="Camera" size={12} color={C.primary} />
            <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 11 }}>Add Photo</Text>
          </Pressable>
        )}
      </View>
      {photos.length === 0 && !readonly ? (
        <Pressable onPress={handleAdd} style={{ height: 78, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed", backgroundColor: C.bg1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Icon name="Camera" size={18} color={C.text3} />
          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Add photos here</Text>
        </Pressable>
      ) : photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {photos.map((p, i) => (
              <Pressable key={i} onPress={() => setPreview(p.uri)}>
                <Image source={{ uri: p.uri }} style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }} />
                <View style={{ position: "absolute", bottom: 4, right: 4, backgroundColor: "#000A", borderRadius: 6, padding: 3 }}>
                  <Icon name="Maximize2" size={9} color="white" />
                </View>
              </Pressable>
            ))}
            {!readonly && onAdd && (
              <Pressable onPress={handleAdd} style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 1.5, borderColor: C.primary, borderStyle: "dashed", backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
                <Icon name="Plus" size={22} color={C.primary} />
              </Pressable>
            )}
          </View>
        </ScrollView>
      ) : null}
      {preview && <PhotoFull uri={preview} onClose={() => setPreview(null)} />}
    </View>
  );
}

// ── Chat modal ────────────────────────────────────────────────────
function normalizeChatMessage(raw: any, fallbackJobId: string): ChatMessage {
  return {
    id: String(raw?.id || `msg-${Date.now()}`),
    jobId: String(raw?.jobId || fallbackJobId),
    senderId: String(raw?.senderId || ""),
    senderName: String(raw?.senderName || (raw?.senderRole === "mechanic" ? "Mechanic" : "Customer")),
    senderRole: raw?.senderRole === "mechanic" ? "mechanic" : "customer",
    text: raw?.text || "",
    imageUri: raw?.imageUri || raw?.imageUrl,
    createdAt: raw?.createdAt || new Date().toISOString(),
    read: Boolean(raw?.read),
  };
}

function ChatModal({ visible, jobId, customerName, onClose }: { visible: boolean; jobId: string; customerName: string; onClose: () => void }) {
  const C = useTheme();
  const { messages, upsertMessage, setMessages } = useChatStore();
  const { socket } = useSocket();
  const [text, setText] = useState("");
  const scroll = useRef<ScrollView>(null);
  const msgs = messages[jobId] || [];

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    apiGetMessages(jobId)
      .then(({ messages: serverMessages }) => {
        if (!cancelled) {
          setMessages(jobId, serverMessages.map(m => normalizeChatMessage(m, jobId)));
        }
      })
      .catch(() => {
        if (!cancelled && (messages[jobId] || []).length === 0) {
          setMessages(jobId, []);
        }
      });

    if (socket) {
      joinJobRoom(socket, jobId);
      const onNewMessage = (payload: any) => {
        const msg = normalizeChatMessage(payload, jobId);
        if (msg.jobId === jobId) {
          upsertMessage(jobId, msg);
          setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
        }
      };
      socket.on("new_message", onNewMessage);
      return () => {
        cancelled = true;
        socket.off("new_message", onNewMessage);
        leaveJobRoom(socket, jobId);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [visible, jobId, socket, setMessages, upsertMessage]);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 200);
  }, [visible, msgs.length]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      const { message } = await apiSendMessage(jobId, body);
      upsertMessage(jobId, normalizeChatMessage(message, jobId));
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert("Chat error", e?.message || "Could not send message. Please try again.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable onPress={onClose} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bg1, alignItems: "center", justifyContent: "center" }}>
            <Icon name="ArrowLeft" size={20} color={C.text2} />
          </Pressable>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
            <Icon name="User" size={18} color={C.primary} />
          </View>
          <View>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Chat — {customerName}</Text>
            <Text style={{ color: C.green, fontFamily: FONTS.regular, fontSize: 12 }}>Active job</Text>
          </View>
        </View>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, gap: 10 }} showsVerticalScrollIndicator={false}>
          {msgs.map((m: ChatMessage, i: number) => {
            const isMe = m.senderRole === "mechanic";
            return (
              <View key={i} style={{ flexDirection: isMe ? "row-reverse" : "row", alignItems: "flex-end", gap: 8 }}>
                {!isMe && <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}><Icon name="User" size={13} color={C.primary} /></View>}
                <View style={{ maxWidth: "72%", backgroundColor: isMe ? C.primary : C.card, borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4, padding: 12, borderWidth: 1, borderColor: isMe ? C.primary : C.cardBorder }}>
                  <Text style={{ color: "white", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 }}>{m.text}</Text>
                  <Text style={{ color: isMe ? "#ffffff88" : C.text3, fontFamily: FONTS.regular, fontSize: 10, marginTop: 4, textAlign: isMe ? "right" : "left" }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg1 }}>
          <Pressable onPress={() => Alert.alert("Media", "Opens camera/gallery in production")} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
            <Icon name="Image" size={18} color={C.primary} />
          </Pressable>
          <TextInput value={text} onChangeText={setText} placeholder="Type a message..." placeholderTextColor={C.text3} style={{ flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12 }} onSubmitEditing={handleSend} />
          <Pressable onPress={handleSend} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" }}>
            <Icon name="Send" size={18} color="white" />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Invoice builder modal ─────────────────────────────────────────
function InvoiceModal({ visible, job, onClose }: { visible: boolean; job: ActiveJob; onClose: () => void }) {
  const C = useTheme();
  const [items, setItems] = useState([{ desc: "", qty: "1", price: "", kind: "service" as "service" | "part" | "labour" }]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { completeJob, shopProfile, addCompletionMedia, syncJobsFromBackend } = useMechanicStore();
  const { addNotification } = useNotifStore();

  const addItem = () => setItems(p => [...p, { desc: "", qty: "1", price: "", kind: "service" }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: string) => setItems(p => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const subtotal = items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1), 0);
  const tax = subtotal * 0.18;
  const total = subtotal + tax;

  const handleGenerate = async () => {
    const valid = items.filter(it => it.desc.trim() && it.price);
    if (valid.length === 0) { Alert.alert("Required", "Please add at least one service item"); return; }
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    const invNum = `INV-${String(Date.now()).slice(-5).padStart(5, "0")}`;
    const invoice: Invoice = {
      id: `inv-${Date.now()}`, jobId: job.id,
      invoiceNumber: invNum, date: new Date().toISOString(),
      shopInfo: { name: shopProfile?.shopName || "Mechanic Shop", address: `${shopProfile?.location?.address || ""}, ${shopProfile?.location?.city || ""}`, phone: job.customer?.phone || "", gstNumber: shopProfile?.gstNumber },
      customerInfo: { name: job.customer?.name || "", phone: job.customer?.phone || "" },
      lineItems: valid.map((it, i) => ({ id: String(i + 1), description: it.desc, quantity: parseInt(it.qty) || 1, unitPrice: parseFloat(it.price) || 0, total: (parseFloat(it.price) || 0) * (parseInt(it.qty) || 1), kind: it.kind })),
      subtotal, tax, total, paymentStatus: "pending",
      notes: notes.trim() || undefined,
    };
    try {
      await apiCompleteJob(job.id, invoice.lineItems.map(it => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
        kind: it.kind,
      })), notes.trim());
      apiGetMechJobs().then(({ jobs }) => syncJobsFromBackend(jobs)).catch(() => {});
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert("Invoice Not Sent", err?.message || "Could not complete the job on the server.");
      return;
    }
    completeJob(job.id, total, invoice);
    addNotification({ id: `n-mech-done-${Date.now()}`, userId: "mech-demo", type: "job_completed", title: "Invoice Sent ✅", message: `Invoice ${invNum} sent to ${job.customer?.name}. Total ₹${total.toFixed(2)}`, read: false, createdAt: new Date().toISOString() });
    setSubmitting(false);
    onClose();
    Alert.alert("Invoice Generated! 🎉", `Invoice ${invNum}\nSent to: ${job.customer?.name}\nTotal: ₹${total.toFixed(2)}`);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable onPress={onClose} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.bg1, alignItems: "center", justifyContent: "center" }}>
            <Icon name="ArrowLeft" size={20} color={C.text2} />
          </Pressable>
          <View>
            <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 18 }}>Generate Invoice</Text>
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>for {job.customer?.name}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.cardBorder }}>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 12 }}>Before-Work Photos</Text>
            <PhotoStrip photos={job.customerMedia} label="Customer uploaded before-work proof" readonly />
          </View>

          {/* After-service photos */}
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.cardBorder }}>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 12 }}>After-Work Proof</Text>
            <PhotoStrip
              photos={job.completionMedia}
              label="Photos/videos after repair"
              jobId={job.id}
              category="completion"
              onAdd={(localUri, remoteUrl) => {
                addCompletionMedia(job.id, {
                  id: `cm-${Date.now()}`, type: /\.(mp4|mov|m4v|webm)$/i.test((remoteUrl || localUri).split("?")[0] || "") ? "video" : "photo",
                  uri: remoteUrl || localUri,
                  uploadedAt: new Date().toISOString(), uploadedBy: "mechanic",
                });
              }}
            />
          </View>

          {/* Line items */}
          <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 12 }}>Service Items</Text>
          {items.map((item, i) => (
            <View key={i} style={{ backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.cardBorder }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ color: C.text2, fontFamily: FONTS.semibold, fontSize: 13 }}>Item {i + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(i)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: C.redDim, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="X" size={13} color={C.red} />
                  </Pressable>
                )}
              </View>
              <TextInput value={item.desc} onChangeText={v => updateItem(i, "desc", v)} placeholder="Description (e.g. Tyre replacement)" placeholderTextColor={C.text3} style={{ backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, color: C.text1, fontFamily: FONTS.regular, fontSize: 14, paddingVertical: 11, paddingHorizontal: 13, marginBottom: 8 }} />
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                {(["service", "part", "labour"] as const).map(kind => (
                  <Pressable key={kind} onPress={() => updateItem(i, "kind", kind)} style={{ flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center", backgroundColor: item.kind === kind ? C.primaryDim : C.bg, borderWidth: 1, borderColor: item.kind === kind ? C.primary : C.border }}>
                    <Text style={{ color: item.kind === kind ? C.primary : C.text3, fontFamily: FONTS.bold, fontSize: 11, textTransform: "capitalize" }}>{kind}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 10, marginBottom: 4 }}>QTY</Text>
                  <TextInput value={item.qty} onChangeText={v => updateItem(i, "qty", v)} keyboardType="numeric" style={{ backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 11, paddingHorizontal: 13, textAlign: "center" }} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 10, marginBottom: 4 }}>PRICE (₹)</Text>
                  <TextInput value={item.price} onChangeText={v => updateItem(i, "price", v)} keyboardType="numeric" placeholder="0.00" placeholderTextColor={C.text3} style={{ backgroundColor: C.bg, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 11, paddingHorizontal: 13 }} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={{ color: C.text3, fontFamily: FONTS.medium, fontSize: 10, marginBottom: 4 }}>TOTAL</Text>
                  <View style={{ backgroundColor: C.bg1, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingVertical: 11, paddingHorizontal: 13 }}>
                    <Text style={{ color: C.green, fontFamily: FONTS.bold, fontSize: 15 }}>₹{((parseFloat(item.price) || 0) * (parseInt(item.qty) || 1)).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}

          <Pressable onPress={addItem} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.primaryDim, borderRadius: 14, padding: 13, marginBottom: 20, borderWidth: 1, borderColor: C.primary + "40" }}>
            <Icon name="Plus" size={18} color={C.primary} />
            <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 14 }}>Add Another Item</Text>
          </Pressable>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 8 }}>Repair Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add work done, parts replaced, warranty or advice for the customer..."
              placeholderTextColor={C.text3}
              multiline
              numberOfLines={4}
              style={{ backgroundColor: C.card, borderRadius: 14, borderWidth: 1.5, borderColor: C.cardBorder, color: C.text1, fontFamily: FONTS.regular, fontSize: 14, padding: 14, minHeight: 96, textAlignVertical: "top" }}
            />
          </View>

          {/* Totals */}
          <LinearGradient colors={[C.isDark ? "#0D1A12" : "#F0FFF8", C.isDark ? "#0A1520" : "#E8F8F0"]} style={{ borderRadius: 18, padding: 18, borderWidth: 1, borderColor: C.green + "30" }}>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15, marginBottom: 14 }}>Invoice Summary</Text>
            {[["Subtotal", `₹${subtotal.toFixed(2)}`], ["GST 18%", `₹${tax.toFixed(2)}`]].map(([l, v]) => (
              <View key={l} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 14 }}>{l}</Text>
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 14 }}>{v}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: C.green + "30", marginVertical: 10 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 18 }}>Total Due</Text>
              <Text style={{ color: C.green, fontFamily: FONTS.black, fontSize: 26 }}>₹{total.toFixed(2)}</Text>
            </View>
          </LinearGradient>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: C.bg + "F8", borderTopWidth: 1, borderTopColor: C.border, padding: 20, paddingBottom: Platform.OS === "ios" ? 34 : 20 }}>
          <Pressable onPress={handleGenerate} disabled={submitting} style={{ borderRadius: 16, overflow: "hidden", opacity: submitting ? 0.8 : 1 }}>
            <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
              <Icon name="FileText" size={20} color="white" />
              <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>{submitting ? "Generating..." : "Generate Invoice & Complete"}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Active Job Card ───────────────────────────────────────────────
function ActiveJobCard({ job }: { job: ActiveJob }) {
  const C = useTheme();
  const { user } = useAuthStore();
  const [chatOpen, setChatOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const { startJob, addProgressMedia, syncJobsFromBackend } = useMechanicStore();
  const { addNotification } = useNotifStore();
  const statusColor = job.status === "accepted" ? C.blue : job.status === "arrived" ? C.green : C.orange;

  const handleArrive = () => {
    Alert.alert("Mark Arrived?", "Confirm that you have reached the customer location.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Arrived",
        onPress: async () => {
          try {
            await apiArriveJob(job.id);
            await apiGetMechJobs().then(({ jobs }) => syncJobsFromBackend(jobs));
            addNotification({ id: `n-mech-arrive-${Date.now()}`, userId: "mech-demo", type: "job_arrived", title: "Marked Arrived", message: `You reached ${job.customer?.name || "the customer"}`, read: false, createdAt: new Date().toISOString() });
          } catch (err: any) {
            Alert.alert("Could Not Mark Arrived", err?.message || "Please check the server and try again.");
          }
        },
      },
    ]);
  };

  const handleStart = () => {
    Alert.alert("Start Job?", "Confirm you're at the customer location and ready to work.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, Start Job",
        onPress: async () => {
          try {
            await apiStartJob(job.id);
            startJob(job.id);
            apiGetMechJobs().then(({ jobs }) => syncJobsFromBackend(jobs)).catch(() => {});
            addNotification({ id: `n-mech-start-${Date.now()}`, userId: "mech-demo", type: "job_started", title: "Job Started", message: `You started the ${job.serviceType.replace(/-/g, " ")} job`, read: false, createdAt: new Date().toISOString() });
          } catch (err: any) {
            Alert.alert("Could Not Start Job", err?.message || "Please check the server and try again.");
          }
        },
      },
    ]);
  };

  const timelineSteps = [
    { label: "Request Received", time: job.timestamps?.requested ? new Date(job.timestamps.requested).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined, done: true, color: C.green },
    { label: "Accepted", time: job.timestamps?.accepted ? new Date(job.timestamps.accepted).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined, done: !!job.timestamps?.accepted, color: C.blue },
    { label: "En Route", time: job.timestamps?.accepted ? new Date(job.timestamps.accepted).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined, done: !!job.timestamps?.accepted, active: job.status === "accepted", color: C.blue },
    { label: "Arrived", time: job.timestamps?.arrived ? new Date(job.timestamps.arrived).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined, done: job.status === "arrived" || job.status === "in-progress", active: job.status === "arrived", color: C.green },
    { label: "In Progress", time: job.timestamps?.started ? new Date(job.timestamps.started).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined, done: !!job.timestamps?.started, active: job.status === "in-progress", color: C.orange },
  ];

  return (
    <Card accent={statusColor} glow={statusColor + "30"} style={{ marginBottom: 16 }}>
      {/* Status header */}
      <LinearGradient colors={[statusColor + "22", "transparent"]} style={{ paddingHorizontal: 18, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {job.status === "in-progress" && <PulseDot color={C.orange} size={5} />}
          <Text style={{ color: statusColor, fontFamily: FONTS.bold, fontSize: 12, letterSpacing: 1 }}>
            {job.status === "accepted" ? "EN ROUTE" : job.status === "arrived" ? "ARRIVED" : "IN PROGRESS"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={() => setChatOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.primaryDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
            <Icon name="MessageSquare" size={13} color={C.primary} />
            <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 11 }}>Chat</Text>
          </Pressable>
          <Pressable onPress={() => setExpanded(!expanded)}>
            <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={18} color={C.text3} />
          </Pressable>
        </View>
      </LinearGradient>

      {expanded && (
        <View style={{ padding: 18, paddingTop: 8 }}>
          {/* Service name */}
          <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 18, textTransform: "capitalize", marginBottom: 4 }}>{job.serviceType.replace(/-/g, " ")}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 16 }}>
            <Icon name="MapPin" size={12} color={C.primary} />
            <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>{job.location?.address}, {job.location?.city}</Text>
          </View>

          {/* Timeline */}
          <View style={{ backgroundColor: C.bg1, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text2, fontFamily: FONTS.semibold, fontSize: 12, letterSpacing: 0.8, marginBottom: 12 }}>JOB TIMELINE</Text>
            <JobTimeline steps={timelineSteps} />
          </View>

          {/* Customer info */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: C.bg1, borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
            <LinearGradient colors={[C.primary, C.primaryDark]} style={{ width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
              <Icon name="User" size={22} color="white" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 15 }}>{job.customer?.name}</Text>
              <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{job.customer?.phone}</Text>
              {job.vehicleInfo?.make && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2, textTransform: "capitalize" }}>{job.vehicleInfo.make} {job.vehicleInfo.model} • {job.vehicleInfo.type}</Text>}
            </View>
            <Pressable style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.greenDim, alignItems: "center", justifyContent: "center" }}>
              <Icon name="Phone" size={20} color={C.green} />
            </Pressable>
          </View>

          {/* Customer vehicle photos (uploaded BEFORE acceptance) */}
          {/* Live tracking map for mechanic to see customer location */}
          {["accepted", "arrived", "in-progress"].includes(job.status) && !!job.customer && (
            <TrackingMap
              customerName={job.customer?.name ?? "Customer"}
              mechanicName={user?.name ?? "Mechanic"}
              customerCoords={undefined}
              distance={2.4}
              eta={job.status === "accepted" ? "12 min" : "On site"}
              status={job.status}
              viewerRole="mechanic"
            />
          )}

          {job.customerMedia.length > 0 && (
            <PhotoStrip photos={job.customerMedia} label="📷 Customer's vehicle photos" readonly />
          )}

          {/* Description */}
          {job.description && (
            <View style={{ backgroundColor: C.bg1, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 20, fontStyle: "italic" }}>"{job.description}"</Text>
            </View>
          )}

          {/* Progress photos */}
          {job.status === "in-progress" && (
            <MediaStrip
              photos={job.progressMedia}
              label="🔧 Progress photos"
              jobId={job.id}
              category="progress"
              onAdd={(localUri, remoteUrl) => {
                addProgressMedia(job.id, {
                  id: `pm-${Date.now()}`, type: "photo",
                  uri: remoteUrl || localUri,
                  uploadedAt: new Date().toISOString(), uploadedBy: "mechanic",
                });
              }}
            />
          )}

          <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginBottom: 14 }}>
            Received {formatDistanceToNow(new Date(job.timestamps?.requested || Date.now()), { addSuffix: true })}
          </Text>

          {/* Action buttons */}
          {job.status === "accepted" && (
            <Pressable onPress={handleArrive} style={{ borderRadius: 16, overflow: "hidden" }}>
              <LinearGradient colors={[C.blue, C.blueDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                <Icon name="MapPinCheck" size={20} color="white" />
                <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Mark Arrived</Text>
              </LinearGradient>
            </Pressable>
          )}

          {job.status === "arrived" && (
            <Pressable onPress={handleStart} style={{ borderRadius: 16, overflow: "hidden" }}>
              <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                <Icon name="Play" size={20} color="white" />
                <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Start Work</Text>
              </LinearGradient>
            </Pressable>
          )}

          {job.status === "in-progress" && (
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => selectAndUploadPhoto({
                  jobId: job.id, category: "progress",
                  onPicked: (localUri, remoteUrl) => {
                    addProgressMedia(job.id, { id: `pm-${Date.now()}`, type: "photo", uri: remoteUrl || localUri, uploadedAt: new Date().toISOString(), uploadedBy: "mechanic" });
                  },
                })} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.primaryDim, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: C.primary + "50" }}>
                <Icon name="Camera" size={18} color={C.primary} />
                <Text style={{ color: C.primary, fontFamily: FONTS.bold, fontSize: 14 }}>Add Progress Photo</Text>
              </Pressable>
              <Pressable onPress={() => setInvoiceOpen(true)} style={{ borderRadius: 16, overflow: "hidden" }}>
                <LinearGradient colors={[C.green, C.greenDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}>
                  <Icon name="FileText" size={20} color="white" />
                  <Text style={{ color: "white", fontFamily: FONTS.black, fontSize: 16 }}>Complete Job & Invoice</Text>
                </LinearGradient>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <ChatModal visible={chatOpen} jobId={job.id} customerName={job.customer?.name || "Customer"} onClose={() => setChatOpen(false)} />
      <InvoiceModal visible={invoiceOpen} job={job} onClose={() => setInvoiceOpen(false)} />
    </Card>
  );
}

// ── Main Screen ───────────────────────────────────────────────────
export default function ActiveJobs() {
  const C = useTheme();
  const { activeJobs, completedJobs, syncJobsFromBackend } = useMechanicStore();
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [completedChatJob, setCompletedChatJob] = useState<ActiveJob | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      apiGetMechJobs()
        .then(({ jobs }) => {
          if (!cancelled) syncJobsFromBackend(jobs);
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [syncJobsFromBackend]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={[C.isDark ? "#0A0A1E" : "#F0F4FF", C.bg]} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 26 }}>Jobs</Text>
        <View style={{ flexDirection: "row", backgroundColor: C.bg1, borderRadius: 14, padding: 4, marginTop: 14 }}>
          {[
            { key: "active", label: "Active", count: activeJobs.length, color: C.blue },
            { key: "completed", label: "Completed", count: completedJobs.length, color: C.green },
          ].map(t => (
            <Pressable key={t.key} onPress={() => setTab(t.key as any)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 11, borderRadius: 11, backgroundColor: tab === t.key ? C.card : "transparent" }}>
              <Text style={{ color: tab === t.key ? t.color : C.text3, fontFamily: tab === t.key ? FONTS.bold : FONTS.regular, fontSize: 14 }}>{t.label}</Text>
              <View style={{ backgroundColor: t.color + "25", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                <Text style={{ color: t.color, fontFamily: FONTS.bold, fontSize: 11 }}>{t.count}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </LinearGradient>

      {tab === "active" ? (
        activeJobs.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 56, marginBottom: 20 }}>💼</Text>
            <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 8 }}>No Active Jobs</Text>
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>Accept requests from the Requests tab to start working</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}>
            {activeJobs.map(job => <ActiveJobCard key={job.id} job={job} />)}
          </ScrollView>
        )
      ) : (
        completedJobs.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 56, marginBottom: 20 }}>✅</Text>
            <Text style={{ color: C.text2, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 8 }}>No Completed Jobs</Text>
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center" }}>Completed jobs appear here</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }}>
            {completedJobs.map(job => (
              <View key={job.id} style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.green + "25", padding: 16, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.greenDim, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="CheckCircle" size={22} color={C.green} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 14, textTransform: "capitalize" }}>{job.serviceType.replace(/-/g, " ")}</Text>
                  <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{job.customer?.name}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Text style={{ color: C.green, fontFamily: FONTS.black, fontSize: 15 }}>₹{job.invoice?.total.toFixed(0) || "—"}</Text>
                  <Text style={{ color: job.invoice?.paymentStatus === "paid" ? C.green : C.yellow, fontFamily: FONTS.semibold, fontSize: 10, textAlign: "right" }}>
                    {job.invoice?.paymentStatus === "paid" ? "PAID" : "PENDING"}
                  </Text>
                  <Pressable onPress={() => setCompletedChatJob(job)} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.primaryDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                    <Icon name="MessageSquare" size={12} color={C.primary} />
                    <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 11 }}>Chat</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>
        )
      )}
      {completedChatJob && (
        <ChatModal
          visible={!!completedChatJob}
          jobId={completedChatJob.id}
          customerName={completedChatJob.customer?.name || "Customer"}
          onClose={() => setCompletedChatJob(null)}
        />
      )}
    </SafeAreaView>
  );
}
