import React, { useState, useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { Card, Badge, GradientBtn, PulseDot, JobTimeline } from "~/components/ui";
import { COLORS, FONTS, STATUS_CFG } from "~/constants";
import { useCustomerStore, useChatStore, useAuthStore } from "~/stores";

const STEPS = [
  { key: "pending",     label: "Request Sent",   tsKey: "requested" },
  { key: "accepted",    label: "Mechanic Accepted", tsKey: "accepted" },
  { key: "in-progress", label: "Work In Progress",  tsKey: "started" },
  { key: "completed",   label: "Job Completed",     tsKey: "completed" },
];

export default function JobDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { jobs, cancelJob } = useCustomerStore();
  const { messages, sendMessage } = useChatStore();
  const { user } = useAuthStore();
  const job = jobs.find(j => j.id === id) || jobs[0];
  const [showChat, setShowChat] = useState(false);
  const [chatText, setChatText] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  if (!job) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🔍</Text>
      <Text style={{ color: COLORS.text3, fontFamily: FONTS.semibold, fontSize: 16 }}>Job not found</Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 16, backgroundColor: COLORS.orangeDim, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
        <Text style={{ color: COLORS.orange, fontFamily: FONTS.semibold }}>Go Back</Text>
      </Pressable>
    </SafeAreaView>
  );

  const cfg = STATUS_CFG[job.status];
  const chatMsgs = messages[id || "default"] || messages["default"] || [];
  const canChat = ["accepted","in-progress","completed"].includes(job.status);

  const timelineSteps = STEPS.map((step, i) => {
    const tsKey = step.tsKey as keyof typeof job.timestamps;
    const ts = job.timestamps[tsKey];
    const statusOrder = ["pending","accepted","in-progress","completed"];
    const currentIdx = statusOrder.indexOf(job.status);
    const stepIdx = statusOrder.indexOf(step.key);
    const done = stepIdx <= currentIdx || !!ts;
    const active = job.status === step.key;
    return {
      label: step.label,
      time: ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : undefined,
      done, active,
      color: cfg.color,
    };
  });

  const handleSend = () => {
    if (!chatText.trim()) return;
    sendMessage(id || "default", {
      id: `msg-${Date.now()}`, jobId: id || "default",
      senderId: user?.id || "customer-demo", senderName: user?.name || "You",
      senderRole: "customer", text: chatText.trim(),
      createdAt: new Date().toISOString(), read: false,
    });
    setChatText("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <LinearGradient colors={["#0A0A1E", COLORS.bg]} style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Pressable onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }}>
          <Icon name="ArrowLeft" size={20} color={COLORS.text2} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 18, textTransform: "capitalize" }}>
            {job.serviceType.replace(/-/g, " ")}
          </Text>
          <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 12 }}>
            {formatDistanceToNow(new Date(job.timestamps.requested), { addSuffix: true })}
          </Text>
        </View>
        <Badge label={cfg.label} color={cfg.color} bg={cfg.bg} pulse={job.status === "in-progress"} />
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* Status card with live indicator */}
          {(job.status === "accepted" || job.status === "in-progress") && (
            <Card accent={cfg.color} glow={cfg.glow} style={{ marginBottom: 16 }}>
              <LinearGradient colors={[cfg.color + "20", "transparent"]} style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: cfg.color + "20", alignItems: "center", justifyContent: "center" }}>
                  <PulseDot color={cfg.color} size={8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: cfg.color, fontFamily: FONTS.bold, fontSize: 15 }}>
                    {job.status === "accepted" ? "Mechanic on the way" : "Work in progress"}
                  </Text>
                  <Text style={{ color: COLORS.text2, fontFamily: FONTS.regular, fontSize: 13, marginTop: 3 }}>
                    {job.status === "accepted"
                      ? `Estimated arrival: ${job.estimatedArrival || "—"}`
                      : "Your mechanic is currently working on your vehicle"}
                  </Text>
                </View>
              </LinearGradient>
            </Card>
          )}

          {/* Job Timeline */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ padding: 20 }}>
              <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16, marginBottom: 18 }}>Job Progress</Text>
              <JobTimeline steps={timelineSteps} />
            </View>
          </Card>

          {/* Mechanic info */}
          {job.mechanic && (
            <Card style={{ marginBottom: 16 }}>
              <View style={{ padding: 18 }}>
                <Text style={{ color: COLORS.text2, fontFamily: FONTS.semibold, fontSize: 12, letterSpacing: 1, marginBottom: 14 }}>YOUR MECHANIC</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <LinearGradient colors={[COLORS.orange, "#FF3D00"]} style={{ width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="User" size={26} color="white" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16 }}>{job.mechanic.name}</Text>
                    <Text style={{ color: COLORS.text2, fontFamily: FONTS.regular, fontSize: 13 }}>{job.mechanic.shopName}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Text style={{ color: COLORS.amber, fontSize: 12 }}>⭐</Text>
                      <Text style={{ color: COLORS.amber, fontFamily: FONTS.bold, fontSize: 12 }}>{job.mechanic.rating}</Text>
                    </View>
                  </View>
                  <Pressable style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.greenDim, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="Phone" size={20} color={COLORS.green} />
                  </Pressable>
                </View>
              </View>
            </Card>
          )}

          {/* Location */}
          <Card style={{ marginBottom: 16 }}>
            <View style={{ padding: 18 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: COLORS.orangeDim, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="MapPin" size={18} color={COLORS.orange} />
                </View>
                <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Service Location</Text>
              </View>
              <Text style={{ color: COLORS.text2, fontFamily: FONTS.regular, fontSize: 14 }}>{job.location.address}</Text>
              <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 13 }}>{job.location.city}, {job.location.state}</Text>
            </View>
          </Card>

          {/* Invoice (if completed) */}
          {job.invoice && (
            <Card accent={job.invoice.paymentStatus === "paid" ? COLORS.green : COLORS.amber} style={{ marginBottom: 16 }}>
              <View style={{ padding: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Invoice</Text>
                  <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{job.invoice.invoiceNumber}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 13 }}>Subtotal</Text>
                  <Text style={{ color: COLORS.text2, fontFamily: FONTS.medium, fontSize: 13 }}>₹{job.invoice.subtotal.toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                  <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 13 }}>GST (18%)</Text>
                  <Text style={{ color: COLORS.text2, fontFamily: FONTS.medium, fontSize: 13 }}>₹{job.invoice.tax.toFixed(2)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: COLORS.border, marginBottom: 10 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
                  <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Total</Text>
                  <Text style={{ color: COLORS.orange, fontFamily: FONTS.black, fontSize: 20 }}>₹{job.invoice.total.toFixed(2)}</Text>
                </View>
                {job.invoice.paymentStatus === "pending" && (
                  <Pressable onPress={() => router.push("/(customer)/invoices")} style={{ borderRadius: 14, overflow: "hidden" }}>
                    <LinearGradient colors={[COLORS.orange, "#FF3D00"]} style={{ paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <Text style={{ fontSize: 18 }}>💳</Text>
                      <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 15 }}>Pay Now</Text>
                    </LinearGradient>
                  </Pressable>
                )}
                {job.invoice.paymentStatus === "paid" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.greenDim, borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontSize: 16 }}>✅</Text>
                    <Text style={{ color: COLORS.green, fontFamily: FONTS.semibold, fontSize: 13 }}>Paid via {job.invoice.paymentMethod}</Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {/* Chat */}
          {canChat && (
            <Card style={{ marginBottom: 16 }}>
              <Pressable onPress={() => setShowChat(!showChat)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.blueDim, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="MessageSquare" size={18} color={COLORS.blue} />
                  </View>
                  <View>
                    <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 15 }}>Chat with Mechanic</Text>
                    <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{chatMsgs.length} messages</Text>
                  </View>
                </View>
                <Icon name={showChat ? "ChevronUp" : "ChevronDown"} size={20} color={COLORS.text3} />
              </Pressable>

              {showChat && (
                <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  <ScrollView ref={scrollRef} style={{ maxHeight: 260 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
                    {chatMsgs.map(msg => {
                      const isMe = msg.senderRole === "customer";
                      return (
                        <View key={msg.id} style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                          {!isMe && <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 11, marginBottom: 4 }}>{msg.senderName}</Text>}
                          <View style={{ maxWidth: "80%", backgroundColor: isMe ? COLORS.orange : COLORS.bg1, borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: isMe ? 16 : 4, padding: 12, borderWidth: 1, borderColor: isMe ? COLORS.orange + "40" : COLORS.border }}>
                            <Text style={{ color: isMe ? "white" : COLORS.text1, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19 }}>{msg.text}</Text>
                          </View>
                          <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 10, marginTop: 4 }}>
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                  <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                    <TextInput
                      value={chatText} onChangeText={setChatText}
                      placeholder="Type a message..."
                      placeholderTextColor={COLORS.text3}
                      style={{ flex: 1, backgroundColor: COLORS.bg1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, color: COLORS.text1, fontFamily: FONTS.regular, fontSize: 14, borderWidth: 1, borderColor: COLORS.border }}
                    />
                    <Pressable onPress={handleSend} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.orange, alignItems: "center", justifyContent: "center" }}>
                      <Icon name="Send" size={18} color="white" />
                    </Pressable>
                  </View>
                </View>
              )}
            </Card>
          )}

          {/* Cancel button */}
          {job.status === "pending" && (
            <Pressable onPress={() => {
              cancelJob(job.id);
              router.back();
            }} style={{ borderRadius: 16, paddingVertical: 15, alignItems: "center", borderWidth: 1.5, borderColor: COLORS.red + "50", backgroundColor: COLORS.redDim }}>
              <Text style={{ color: COLORS.red, fontFamily: FONTS.bold, fontSize: 15 }}>Cancel Request</Text>
            </Pressable>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
