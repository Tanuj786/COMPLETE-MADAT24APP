import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Icon from "~/lib/icons/Icon";
import { PulseDot, useTheme } from "~/components/ui";
import { PressableScale } from "~/components/ui/PressableScale";
import { showToast } from "~/components/ui/Toast";
import { FONTS } from "~/constants";
import { apiAiChat, apiAiStatus, type AiStructured } from "~/lib/api";
import { useAuthStore } from "~/stores";

type ChatMsg =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "assistant"; content: string; data?: AiStructured | null };

const QUICK_PROMPTS: { label: string; emoji: string; text: string }[] = [
  { label: "Tyre flat",        emoji: "🛞",  text: "My tyre is flat — what should I do right now?" },
  { label: "Won't start",      emoji: "🔑",  text: "My car won't start. Engine doesn't crank when I turn the key." },
  { label: "Battery weak",     emoji: "🔋",  text: "Battery seems weak — lights are dim and starter is sluggish." },
  { label: "Out of fuel",      emoji: "⛽",  text: "I think I'm out of fuel. What should I do?" },
  { label: "Engine overheat",  emoji: "🌡️",  text: "Temperature gauge is in red and steam is coming from the bonnet." },
  { label: "Brakes weird",     emoji: "🛑",  text: "Brakes feel spongy / making a grinding noise when I press them." },
  { label: "AC not cool",      emoji: "❄️",  text: "AC is blowing warm air, no cooling at all." },
  { label: "Strange noise",    emoji: "🔊",  text: "There's a strange knocking / rattling noise from the engine bay." },
  { label: "Oil leak",         emoji: "🛢️", text: "I see oil dripping under my car — is it safe to drive?" },
  { label: "Smoke",            emoji: "💨",  text: "Smoke is coming out of the exhaust / engine — what do I do?" },
];

const SEVERITY_THEME: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  low:    { color: "#22C55E", bg: "#22C55E18", label: "LOW SEVERITY",    icon: "CheckCircle"  },
  medium: { color: "#F59E0B", bg: "#F59E0B18", label: "MEDIUM SEVERITY", icon: "AlertTriangle"},
  high:   { color: "#EF4444", bg: "#EF444418", label: "HIGH — UNSAFE",   icon: "AlertOctagon" },
};

const SERVICE_LABELS: Record<string, string> = {
  "tyre-puncture":      "Tyre Puncture",
  "fuel-delivery":      "Fuel Delivery",
  "engine-repair":      "Engine Repair",
  "brake-repair":       "Brake Repair",
  "battery-jump-start": "Battery Jump Start",
  "towing-services":    "Towing",
  "oil-change":         "Oil Change",
  "ac-repair":          "AC Repair",
};

export default function AiAssistantScreen() {
  const C = useTheme();
  const { user } = useAuthStore();
  const isGuest = !user;
  const [messages, setMessages]   = useState<ChatMsg[]>([]);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);
  const [aiAvailable, setAiAvail] = useState<boolean | null>(null);
  const scrollRef                  = useRef<ScrollView>(null);
  const fade                       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    apiAiStatus()
      .then(s => setAiAvail(s.configured))
      .catch(() => setAiAvail(false));
  }, []);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");

    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    scrollToEnd();
    setSending(true);

    try {
      const history = next.map(m => ({ role: m.role, content: m.content }));
      const res = await apiAiChat(history);
      const aiMsg: ChatMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.message || "I'm not sure how to help with that — try describing the problem differently?",
        data: res.structured,
      };
      setMessages(m => [...m, aiMsg]);
      scrollToEnd();
    } catch (err: any) {
      const msg = err?.message?.includes("not configured")
        ? "AI service is not set up yet. Tell the backend admin to add ANTHROPIC_API_KEY."
        : err?.message?.includes("Slow down")
          ? "Slow down — too many questions in one minute. Try again shortly."
          : "Couldn't reach the AI service. Check your internet and try again.";
      showToast(msg, "error");
      setMessages(m => [...m, {
        id: `err-${Date.now()}`, role: "assistant",
        content: msg, data: null,
      }]);
      scrollToEnd();
    } finally {
      setSending(false);
    }
  };

  const goRequestService = (suggestedService: string | null) => {
    if (isGuest) {
      // Guest: park them at signup so they can book the mechanic after creating an account
      router.push("/(auth)/customer-signup" as any);
      return;
    }
    if (suggestedService) {
      router.push({ pathname: "/(customer)/request", params: { service: suggestedService } });
    } else {
      router.push("/(customer)/request");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.isDark ? "#10141C" : "#EEF4FF", C.bg]}
          style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              onPress={() => router.back()}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.bg1, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="ArrowLeft" size={20} color={C.text2} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{
                  width: 30, height: 30, borderRadius: 9,
                  backgroundColor: "#0F0F0F", borderWidth: 1, borderColor: "#1E1E1E",
                  alignItems: "center", justifyContent: "center",
                  shadowColor: "#F97316", shadowOpacity: 0.4, shadowRadius: 5, elevation: 3,
                }}>
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                </View>
                <Text style={{ color: C.text1, fontFamily: FONTS.black, fontSize: 17, letterSpacing: -0.3 }}>
                  AI Automobile Assistant
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                {aiAvailable === null
                  ? <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>Connecting…</Text>
                  : aiAvailable
                    ? (<>
                        <PulseDot color={isGuest ? "#2563EB" : "#22C55E"} size={4} />
                        <Text style={{ color: isGuest ? "#2563EB" : "#22C55E", fontFamily: FONTS.semibold, fontSize: 11 }}>
                          {isGuest ? "Guest mode · 30 free chats/day" : "Online · Powered by Claude"}
                        </Text>
                      </>)
                    : (<>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.text3 }} />
                        <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>
                          Offline — backend not configured
                        </Text>
                      </>)
                }
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── Body ────────────────────────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 && (
            <Animated.View style={{ opacity: fade }}>
              {/* Welcome card */}
              <View style={{ backgroundColor: C.card, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary + "40", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 22 }}>🔧</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 16 }}>Stuck somewhere?</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>Describe the problem — I'll guide you fast.</Text>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {[
                    { icon: "Activity",       text: "Severity diagnosis (low / medium / high)" },
                    { icon: "ListChecks",     text: "2-4 safe steps you can try right now" },
                    { icon: "IndianRupee",    text: "Rough cost estimate (Indian market)" },
                    { icon: "MapPin",         text: "One-tap link to book a verified mechanic" },
                  ].map((item, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <Icon name={item.icon as any} size={14} color={C.primary} />
                      <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13 }}>{item.text}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Quick prompts */}
              <Text style={{ color: C.text3, fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 1.5, marginTop: 14, marginBottom: 10 }}>
                COMMON PROBLEMS — TAP TO ASK
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {QUICK_PROMPTS.map((p, i) => (
                  <PressableScale
                    key={i}
                    onPress={() => send(p.text)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 6,
                      paddingHorizontal: 12, paddingVertical: 9,
                      borderRadius: 14,
                      backgroundColor: C.card,
                      borderWidth: 1, borderColor: C.cardBorder,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{p.emoji}</Text>
                    <Text style={{ color: C.text1, fontFamily: FONTS.medium, fontSize: 12 }}>{p.label}</Text>
                  </PressableScale>
                ))}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, padding: 12, borderRadius: 12, backgroundColor: "#F59E0B12", borderWidth: 1, borderColor: "#F59E0B30" }}>
                <Text style={{ fontSize: 14 }}>⚠️</Text>
                <Text style={{ flex: 1, color: "#F59E0B", fontFamily: FONTS.medium, fontSize: 11.5, lineHeight: 16 }}>
                  AI gives general guidance only — for safety-critical issues always book a verified mechanic.
                </Text>
              </View>

              {/* Guest mode — encourage signup for full feature access */}
              {isGuest && (
                <Pressable
                  onPress={() => router.push("/(auth)/customer-signup" as any)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                    flexDirection: "row", alignItems: "center", gap: 12,
                    padding: 14, borderRadius: 14, marginTop: 12,
                    backgroundColor: "#22C55E12", borderWidth: 1, borderColor: "#22C55E40",
                  })}
                >
                  <Text style={{ fontSize: 22 }}>🚀</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "#22C55E", fontFamily: FONTS.bold, fontSize: 13 }}>Sign up for full access</Text>
                    <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 11.5, marginTop: 1 }}>Book mechanics · Save chat history · Unlimited diagnostics</Text>
                  </View>
                  <Icon name="ArrowRight" size={16} color="#22C55E" />
                </Pressable>
              )}
            </Animated.View>
          )}

          {/* Messages */}
          {messages.map(m => (
            m.role === "user" ? (
              <View key={m.id} style={{ alignItems: "flex-end" }}>
                <LinearGradient
                  colors={[C.primary, C.primaryDark]}
                  style={{ maxWidth: "82%", borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 }}
                >
                  <Text style={{ color: "white", fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 }}>{m.content}</Text>
                </LinearGradient>
              </View>
            ) : (
              <AssistantBubble key={m.id} msg={m} onBookMechanic={goRequestService} isGuest={isGuest} />
            )
          ))}

          {sending && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={{ backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.cardBorder, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 12 }}>Diagnosing…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Input bar ────────────────────────────────────────── */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === "ios" ? 8 : 14, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg1 }}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Describe your vehicle problem…"
            placeholderTextColor={C.text3}
            multiline
            style={{
              flex: 1, color: C.text1, fontFamily: FONTS.regular, fontSize: 14,
              backgroundColor: C.bg, borderRadius: 22, paddingHorizontal: 16,
              paddingVertical: Platform.OS === "ios" ? 12 : 8,
              maxHeight: 100,
              borderWidth: 1, borderColor: C.border,
            }}
            editable={aiAvailable !== false}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || sending || aiAvailable === false}
            style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: input.trim() && !sending && aiAvailable !== false ? C.primary : C.bg2,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Icon name="Send" size={18} color={input.trim() && !sending && aiAvailable !== false ? "white" : C.text3} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Assistant message bubble — structured response card ─────────
function AssistantBubble({
  msg,
  onBookMechanic,
  isGuest = false,
}: {
  msg: ChatMsg & { role: "assistant" };
  onBookMechanic: (svc: string | null) => void;
  isGuest?: boolean;
}) {
  const C = useTheme();
  const data = msg.data;

  if (!data) {
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14 }}>🤖</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 18, borderBottomLeftRadius: 4, padding: 12, borderWidth: 1, borderColor: C.cardBorder }}>
          <Text style={{ color: C.text1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20 }}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  const sev = SEVERITY_THEME[data.severity] || SEVERITY_THEME.medium;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center", marginTop: 4 }}>
        <Text style={{ fontSize: 14 }}>🤖</Text>
      </View>
      <View style={{ flex: 1, backgroundColor: C.card, borderRadius: 18, borderBottomLeftRadius: 4, padding: 14, borderWidth: 1, borderColor: C.cardBorder, gap: 10 }}>
        {/* Severity pill */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.color + "40" }}>
          <Icon name={sev.icon as any} size={12} color={sev.color} />
          <Text style={{ color: sev.color, fontFamily: FONTS.bold, fontSize: 10, letterSpacing: 0.7 }}>{sev.label}</Text>
        </View>

        {/* Summary */}
        <Text style={{ color: C.text1, fontFamily: FONTS.semibold, fontSize: 14, lineHeight: 20 }}>{data.summary}</Text>

        {/* Steps */}
        {data.steps?.length > 0 && (
          <View style={{ gap: 6 }}>
            {data.steps.map((step, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: C.primaryDim, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Text style={{ color: C.primary, fontFamily: FONTS.black, fontSize: 10 }}>{i + 1}</Text>
                </View>
                <Text style={{ flex: 1, color: C.text2, fontFamily: FONTS.regular, fontSize: 13, lineHeight: 19 }}>{step}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Cost */}
        {data.estimatedCostINR && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.divider }}>
            <Icon name="IndianRupee" size={12} color={C.text3} />
            <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 12 }}>Approx cost:</Text>
            <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 13 }}>
              ₹{data.estimatedCostINR.min.toLocaleString("en-IN")} – ₹{data.estimatedCostINR.max.toLocaleString("en-IN")}
            </Text>
          </View>
        )}

        {/* Warning */}
        {data.warning && (
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 10, backgroundColor: "#EF444415", borderWidth: 1, borderColor: "#EF444440" }}>
            <Text style={{ fontSize: 12 }}>⚠️</Text>
            <Text style={{ flex: 1, color: "#EF4444", fontFamily: FONTS.medium, fontSize: 12, lineHeight: 17 }}>{data.warning}</Text>
          </View>
        )}

        {/* CTA — book mechanic */}
        {data.needsMechanic && (
          <PressableScale
            haptic="medium"
            onPress={() => onBookMechanic(data.suggestedService)}
            style={{ borderRadius: 14, overflow: "hidden", marginTop: 4 }}
          >
            <LinearGradient
              colors={[C.primary, C.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <View>
                <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 13 }}>
                  {isGuest ? "Sign Up to Book a Mechanic" : "Book a Mechanic"}
                </Text>
                {data.suggestedService && (
                  <Text style={{ color: "rgba(255,255,255,0.78)", fontFamily: FONTS.regular, fontSize: 11, marginTop: 1 }}>
                    Suggested: {SERVICE_LABELS[data.suggestedService] || data.suggestedService}
                  </Text>
                )}
              </View>
              <Icon name="ArrowRight" size={18} color="white" />
            </LinearGradient>
          </PressableScale>
        )}
      </View>
    </View>
  );
}
