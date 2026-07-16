import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { formatDistanceToNow } from "date-fns";
import { useFocusEffect } from "expo-router";
import Icon from "~/lib/icons/Icon";
import { COLORS, FONTS } from "~/constants";
import { useChatStore, useAuthStore, useMechanicStore, type ActiveJob } from "~/stores";
import { apiGetMechJobs, apiGetMessages, apiSendMessage } from "~/lib/api";
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

function uniqueJobs(activeJobs: ActiveJob[], completedJobs: ActiveJob[]) {
  const seen = new Set<string>();
  return [...activeJobs, ...completedJobs].filter(job => {
    if (seen.has(job.id)) return false;
    seen.add(job.id);
    return true;
  });
}

export default function MechanicChat() {
  const { messages, sendMessage, upsertMessage, setMessages } = useChatStore();
  const { user } = useAuthStore();
  const { activeJobs, completedJobs, syncJobsFromBackend } = useMechanicStore();
  const { socket } = useSocket();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const conversations = useMemo(() => uniqueJobs(activeJobs, completedJobs), [activeJobs, completedJobs]);
  const selectedJob = conversations.find(job => job.id === selectedId) || conversations[0];
  const jobId = selectedJob?.id || "default";
  const chatMsgs = messages[jobId] || [];
  const customerName = selectedJob?.customer?.name || "Customer";
  const isCompleted = !!selectedJob && completedJobs.some(job => job.id === selectedJob.id);

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

  useEffect(() => {
    if (!selectedId && conversations[0]?.id) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (conversations.length === 0) return;
    let cancelled = false;
    conversations.forEach(job => {
      apiGetMessages(job.id)
        .then(({ messages: serverMessages }) => {
          if (!cancelled) {
            setMessages(job.id, serverMessages.map(m => normalizeChatMessage(m, job.id)));
          }
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [conversations, setMessages]);

  useEffect(() => {
    if (!socket || conversations.length === 0) return;
    conversations.forEach(job => joinJobRoom(socket, job.id));
    const onNewMessage = (payload: any) => {
      const msg = normalizeChatMessage(payload, payload?.jobId || "");
      if (!msg.jobId) return;
      upsertMessage(msg.jobId, msg);
      if (msg.jobId === jobId) {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };
    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
      conversations.forEach(job => leaveJobRoom(socket, job.id));
    };
  }, [socket, conversations, upsertMessage, jobId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [jobId, chatMsgs.length]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || !selectedJob) return;
    setText("");
    try {
      const { message } = await apiSendMessage(selectedJob.id, body);
      upsertMessage(selectedJob.id, normalizeChatMessage(message, selectedJob.id));
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert("Chat error", e?.message || "Could not send message. Please try again.");
    }
  };

  const handleImage = () => {
    if (!selectedJob) return;
    Alert.alert("Send Photo", "Photo chat from this inbox will be enabled with the media picker.");
    sendMessage(selectedJob.id, {
      id: `local-${Date.now()}`,
      jobId: selectedJob.id,
      senderId: user?.id || "mech-demo",
      senderName: user?.name || "You",
      senderRole: "mechanic",
      text: "[Photo pending]",
      createdAt: new Date().toISOString(),
      read: false,
    });
  };

  if (conversations.length === 0) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <LinearGradient colors={["#0A0A1E", COLORS.bg]} style={{ paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Text style={{ color: COLORS.text1, fontFamily: FONTS.black, fontSize: 24 }}>Chats</Text>
      </LinearGradient>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Icon name="MessageSquare" size={52} color={COLORS.text3} />
        <Text style={{ color: COLORS.text2, fontFamily: FONTS.bold, fontSize: 18, marginTop: 16, marginBottom: 8 }}>No Chats Yet</Text>
        <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center", lineHeight: 22 }}>
          Conversations appear after you accept a job.
        </Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <LinearGradient colors={["#0A0A1E", COLORS.bg]} style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <Text style={{ color: COLORS.text1, fontFamily: FONTS.black, fontSize: 24 }}>Chats</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 14 }}>
          {conversations.map(job => {
            const last = (messages[job.id] || []).slice(-1)[0];
            const active = job.id === jobId;
            const done = completedJobs.some(j => j.id === job.id);
            return (
              <Pressable
                key={job.id}
                onPress={() => setSelectedId(job.id)}
                style={{ width: 230, backgroundColor: active ? COLORS.card : COLORS.bg1, borderWidth: 1.5, borderColor: active ? COLORS.orange : COLORS.border, borderRadius: 16, padding: 12 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: done ? COLORS.greenDim : COLORS.orangeDim, alignItems: "center", justifyContent: "center" }}>
                    <Icon name={done ? "CheckCircle" : "User"} size={18} color={done ? COLORS.green : COLORS.orange} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 14 }} numberOfLines={1}>{job.customer?.name || "Customer"}</Text>
                    <Text style={{ color: done ? COLORS.green : COLORS.blue, fontFamily: FONTS.semibold, fontSize: 11 }} numberOfLines={1}>
                      {done ? "Completed" : String(job.status).replace(/-/g, " ")}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 12, marginTop: 8 }} numberOfLines={1}>
                  {job.serviceType?.replace(/-/g, " ") || "Service"}
                </Text>
                <Text style={{ color: COLORS.text2, fontFamily: FONTS.regular, fontSize: 12, marginTop: 5 }} numberOfLines={1}>
                  {last?.text || "No messages yet"}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <LinearGradient colors={["#111827", COLORS.bg]} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <LinearGradient colors={[COLORS.orange, "#FF3D00"]} style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
          <Icon name="User" size={21} color="white" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ color: COLORS.text1, fontFamily: FONTS.bold, fontSize: 16 }}>{customerName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isCompleted ? COLORS.text3 : COLORS.green }} />
            <Text style={{ color: isCompleted ? COLORS.text3 : COLORS.green, fontFamily: FONTS.regular, fontSize: 12 }}>{isCompleted ? "Completed job" : "Active service"}</Text>
          </View>
        </View>
        <View style={{ backgroundColor: COLORS.orangeDim, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 }}>
          <Text style={{ color: COLORS.orange, fontFamily: FONTS.semibold, fontSize: 11 }} numberOfLines={1}>
            {selectedJob?.serviceType?.replace(/-/g, " ") || "Service"}
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {chatMsgs.length === 0 && (
            <View style={{ alignItems: "center", padding: 24 }}>
              <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 14, textAlign: "center" }}>
                Chat started. Say hello to {customerName}.
              </Text>
            </View>
          )}
          {chatMsgs.map(msg => {
            const isMe = msg.senderRole === "mechanic";
            return (
              <View key={msg.id} style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
                {!isMe && <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 11, marginBottom: 4 }}>{msg.senderName}</Text>}
                <View style={{ maxWidth: "78%", backgroundColor: isMe ? COLORS.blue : COLORS.card, borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4, padding: 13, borderWidth: 1, borderColor: isMe ? COLORS.blue + "50" : COLORS.cardBorder }}>
                  <Text style={{ color: "white", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 }}>{msg.text}</Text>
                </View>
                <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 10, marginTop: 4 }}>
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                </Text>
              </View>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.bg }}>
          <Pressable onPress={handleImage} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }}>
            <Icon name="Camera" size={20} color={COLORS.text2} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
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
