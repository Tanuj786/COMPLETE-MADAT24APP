import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { formatDistanceToNow } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { COLORS, FONTS } from "~/constants";
import { useChatStore, useAuthStore, useMechanicStore } from "~/stores";
import { apiGetMessages, apiSendMessage } from "~/lib/api";
import { joinJobRoom, leaveJobRoom, useSocket } from "~/hooks/useSocket";
import type { ChatMessage } from "~/types";

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

export default function MechanicChat() {
  const { messages, sendMessage, upsertMessage, setMessages } = useChatStore();
  const { user } = useAuthStore();
  const { activeJobs, completedJobs } = useMechanicStore();
  const { socket } = useSocket();
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const selectedJob = activeJobs[0] || completedJobs[0];
  const jobId = selectedJob?.id || "default";
  const chatMsgs = messages[jobId] || messages["default"] || [];
  const customerName = selectedJob?.customer?.name || "Customer";
  const isCompleted = !!selectedJob && completedJobs.some(job => job.id === selectedJob.id);

  useEffect(() => {
    if (!selectedJob?.id) return;
    let cancelled = false;

    apiGetMessages(jobId)
      .then(({ messages: serverMessages }) => {
        if (!cancelled) {
          setMessages(jobId, serverMessages.map(m => normalizeChatMessage(m, jobId)));
        }
      })
      .catch(() => {});

    if (socket) {
      joinJobRoom(socket, jobId);
      const onNewMessage = (payload: any) => {
        const msg = normalizeChatMessage(payload, jobId);
        if (msg.jobId === jobId) {
          upsertMessage(jobId, msg);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
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
  }, [selectedJob?.id, jobId, socket, setMessages, upsertMessage]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    if (jobId === "default") {
      sendMessage(jobId, {
        id: `msg-${Date.now()}`, jobId,
        senderId: user?.id || "mech-demo", senderName: user?.name || "You",
        senderRole: "mechanic", text: body,
        createdAt: new Date().toISOString(), read: false,
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      return;
    }
    try {
      const { message } = await apiSendMessage(jobId, body);
      upsertMessage(jobId, normalizeChatMessage(message, jobId));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert("Chat error", e?.message || "Could not send message. Please try again.");
    }
  };

  const handleImage = () => {
    Alert.alert("Send Photo", "Attach a progress photo to the chat.", [
      { text: "Camera (Mock)", onPress: () => {
        sendMessage(jobId, {
          id: `msg-${Date.now()}`, jobId,
          senderId: user?.id || "mech-demo", senderName: user?.name || "You",
          senderRole: "mechanic", text: "📷 [Photo attached]",
          createdAt: new Date().toISOString(), read: false,
        });
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (!selectedJob) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>💬</Text>
        <Text style={{ color: COLORS.text2, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 8 }}>No Chats Yet</Text>
        <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          Chat becomes available once you accept a job request.
        </Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Chat header */}
      <LinearGradient colors={["#0A0A1E", COLORS.bg]} style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <LinearGradient colors={[COLORS.orange, "#FF3D00"]} style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
          <Icon name="User" size={22} color="white" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16 }}>{customerName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isCompleted ? COLORS.text3 : COLORS.green }} />
            <Text style={{ color: isCompleted ? COLORS.text3 : COLORS.green, fontFamily: FONTS.regular, fontSize: 12 }}>{isCompleted ? "Completed job" : "Online"}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: COLORS.orangeDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
          <Text style={{ color: COLORS.orange, fontFamily: FONTS.semibold, fontSize: 11 }}>
            {selectedJob?.serviceType?.replace(/-/g, " ") || "Service"}
          </Text>
        </View>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {chatMsgs.length === 0 && (
            <View style={{ alignItems: "center", padding: 24 }}>
              <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center" }}>
                Chat started. Say hello to {customerName}!
              </Text>
            </View>
          )}
          {chatMsgs.map(msg => {
            const isMe = msg.senderRole === "mechanic";
            return (
              <View key={msg.id} style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && (
                  <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 11, marginBottom: 4 }}>{msg.senderName}</Text>
                )}
                <View style={{
                  maxWidth: "78%",
                  backgroundColor: isMe ? COLORS.blue : COLORS.card,
                  borderRadius: 18,
                  borderBottomRightRadius: isMe ? 4 : 18,
                  borderBottomLeftRadius: isMe ? 18 : 4,
                  padding: 13,
                  borderWidth: 1,
                  borderColor: isMe ? COLORS.blue + "50" : COLORS.cardBorder,
                }}>
                  <Text style={{ color: "white", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 }}>{msg.text}</Text>
                </View>
                <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 10, marginTop: 4 }}>
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Input */}
        <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg }}>
          <Pressable onPress={handleImage} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }}>
            <Icon name="Camera" size={20} color={COLORS.text2} />
          </Pressable>
          <TextInput
            value={text} onChangeText={setText}
            placeholder={isCompleted ? "Message about this completed job..." : "Message customer..."}
            placeholderTextColor={COLORS.text3}
            multiline
            style={{ flex: 1, backgroundColor: COLORS.bg1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, color: COLORS.text1, fontFamily: FONTS.regular, fontSize: 14, borderWidth: 1, borderColor: COLORS.border, maxHeight: 100 }}
          />
          <Pressable onPress={handleSend} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.blue, alignItems: "center", justifyContent: "center" }}>
            <Icon name="Send" size={20} color="white" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
