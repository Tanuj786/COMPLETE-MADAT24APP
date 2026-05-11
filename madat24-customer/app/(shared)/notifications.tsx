import React, { useRef, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import Icon from "~/lib/icons/Icon";
import { COLORS, FONTS } from "~/constants";
import { useNotifStore } from "~/stores";
import type { AppNotification } from "~/types";

const NOTIF_CFG: Record<string, { icon: string; color: string; emoji: string }> = {
  job_request:       { icon: "Inbox",        color: COLORS.amber,  emoji: "📥" },
  job_accepted:      { icon: "CheckCircle",  color: COLORS.green,  emoji: "✅" },
  job_started:       { icon: "Play",         color: COLORS.blue,   emoji: "🔧" },
  job_completed:     { icon: "CheckCircle2", color: COLORS.green,  emoji: "🎉" },
  payment_requested: { icon: "IndianRupee",  color: COLORS.orange, emoji: "💳" },
  payment_received:  { icon: "IndianRupee",  color: COLORS.green,  emoji: "💰" },
  rating_received:   { icon: "Star",         color: COLORS.amber,  emoji: "⭐" },
  message:           { icon: "MessageSquare",color: COLORS.blue,   emoji: "💬" },
  info:              { icon: "Info",         color: COLORS.text2,  emoji: "ℹ️" },
};

export default function Notifications() {
  const { notifications, markRead, markAllRead } = useNotifStore();
  const unread = notifications.filter(n => !n.read).length;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: COLORS.bg1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border }}>
            <Icon name="ArrowLeft" size={20} color={COLORS.text2} />
          </Pressable>
          <View>
            <Text style={{ color: COLORS.text1, fontFamily: FONTS.black, fontSize: 22 }}>Notifications</Text>
            {unread > 0 && <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 12 }}>{unread} unread</Text>}
          </View>
        </View>
        {unread > 0 && (
          <Pressable onPress={markAllRead} style={{ backgroundColor: COLORS.orangeDim, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.orange + "40" }}>
            <Text style={{ color: COLORS.orange, fontFamily: FONTS.semibold, fontSize: 12 }}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40 }}>
        {notifications.length === 0 ? (
          <Animated.View style={{ opacity: fadeAnim, alignItems: "center", paddingTop: 80 }}>
            <Text style={{ fontSize: 60, marginBottom: 16 }}>🔕</Text>
            <Text style={{ color: COLORS.text2, fontFamily: FONTS.bold, fontSize: 18, marginBottom: 8 }}>No notifications</Text>
            <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 14 }}>You're all caught up!</Text>
          </Animated.View>
        ) : notifications.map((n: AppNotification, idx) => {
          const cfg = NOTIF_CFG[n.type] || { icon: "Bell", color: COLORS.text2, emoji: "🔔" };
          return (
            <Animated.View key={n.id} style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0,1], outputRange: [20,0] }) }] }}>
              <Pressable onPress={() => markRead(n.id)} style={{ marginBottom: 10 }}>
                <View style={{
                  backgroundColor: n.read ? COLORS.card : COLORS.bg1,
                  borderRadius: 20, padding: 16,
                  flexDirection: "row", alignItems: "flex-start", gap: 14,
                  borderWidth: n.read ? 1 : 1.5,
                  borderColor: n.read ? COLORS.cardBorder : cfg.color + "50",
                  shadowColor: n.read ? "transparent" : cfg.color,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: n.read ? 0 : 0.15,
                  shadowRadius: 8, elevation: n.read ? 0 : 3,
                }}>
                  <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: cfg.color + "20", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ color: n.read ? COLORS.text2 : COLORS.text1, fontFamily: FONTS.bold, fontSize: 14, flex: 1, lineHeight: 20 }}>{n.title}</Text>
                      {!n.read && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color, marginLeft: 8, marginTop: 6 }} />
                      )}
                    </View>
                    <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19, marginBottom: 8 }}>{n.message}</Text>
                    <Text style={{ color: COLORS.text3, fontFamily: FONTS.regular, fontSize: 11 }}>
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
