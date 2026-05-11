import React, { useRef, useEffect } from "react";
import {
  View, Text, Pressable, Animated, ViewStyle,
  ActivityIndicator, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONTS } from "~/constants";
import { useThemeStore } from "~/stores/themeStore";

// ─── Helper: use theme colors ─────────────────────────────────────────────
export function useTheme() {
  return useThemeStore(s => s.colors);
}

// ─── Animated Pulse Dot ────────────────────────────────────────────────────
export function PulseDot({ color, size = 8 }: { color?: string; size?: number }) {
  const C = useTheme();
  const col = color || C.primary;
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([Animated.timing(scale,   { toValue: 1.7, duration: 800, useNativeDriver: true }), Animated.timing(scale,   { toValue: 1, duration: 800, useNativeDriver: true })]),
      Animated.sequence([Animated.timing(opacity, { toValue: 0.2, duration: 800, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true })]),
    ])).start();
  }, []);
  return (
    <View style={{ width: size * 2, height: size * 2, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: size * 2, height: size * 2, borderRadius: size, backgroundColor: col, opacity, transform: [{ scale }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: col }} />
    </View>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ children, style, accent, glow }: { children: React.ReactNode; style?: ViewStyle; accent?: string; glow?: string }) {
  const C = useTheme();
  return (
    <View style={[{ backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: accent ? accent + "30" : C.cardBorder, overflow: "hidden", shadowColor: glow || accent || "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: glow ? 0.25 : 0.08, shadowRadius: 12, elevation: 4 }, style]}>
      {accent && <View style={{ height: 3, backgroundColor: accent }} />}
      {children}
    </View>
  );
}

// ─── GlassCard ─────────────────────────────────────────────────────────────
export function GlassCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const C = useTheme();
  return (
    <View style={[{ backgroundColor: C.isDark ? "#FFFFFF08" : "#00000006", borderRadius: 20, borderWidth: 1, borderColor: C.isDark ? "#FFFFFF12" : "#00000010", overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

// ─── GradientBtn ───────────────────────────────────────────────────────────
export function GradientBtn({ label, onPress, colors: gc, icon, style, disabled, loading }: {
  label: string; onPress: () => void; colors?: [string, string];
  icon?: React.ReactNode; style?: ViewStyle; disabled?: boolean; loading?: boolean;
}) {
  const C = useTheme();
  const btnColors: [string, string] = gc || [C.primary, C.primaryDark];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [style, { opacity: pressed || disabled ? 0.75 : 1, borderRadius: 16 }]}>
      <LinearGradient colors={disabled ? ["#333", "#444"] : btnColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ borderRadius: 16, paddingVertical: 17, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
        {loading ? <ActivityIndicator color="white" size="small" /> : <>
          {icon}
          <Text style={{ color: "white", fontFamily: FONTS.bold, fontSize: 15 }}>{label}</Text>
        </>}
      </LinearGradient>
    </Pressable>
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ label, color, bg, pulse = false }: { label: string; color: string; bg: string; pulse?: boolean }) {
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6 }}>
      {pulse && <PulseDot color={color} size={5} />}
      <Text style={{ color, fontFamily: FONTS.semibold, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

// ─── ProgressBar ───────────────────────────────────────────────────────────
export function ProgressBar({ label, value, color }: { label?: string; value: number; color: string }) {
  const C = useTheme();
  return (
    <View>
      {label && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ color: C.text2, fontFamily: FONTS.regular, fontSize: 13 }}>{label}</Text>
          <Text style={{ color, fontFamily: FONTS.bold, fontSize: 13 }}>{value}%</Text>
        </View>
      )}
      <View style={{ height: 6, backgroundColor: C.bg, borderRadius: 3 }}>
        <View style={{ height: 6, backgroundColor: color, borderRadius: 3, width: `${Math.min(value, 100)}%` }} />
      </View>
    </View>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color, emoji }: { label: string; value: string|number; sub?: string; color: string; emoji?: string }) {
  const C = useTheme();
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: color + "25", flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ color: C.text3, fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 1.5 }}>{label}</Text>
        {emoji && <Text style={{ fontSize: 18 }}>{emoji}</Text>}
      </View>
      <Text style={{ color, fontFamily: FONTS.black, fontSize: 22, marginBottom: 2 }}>{value}</Text>
      {sub && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11 }}>{sub}</Text>}
    </View>
  );
}

// ─── MediaThumb ────────────────────────────────────────────────────────────
export function MediaThumb({ uri, size = 80 }: { uri: string; size?: number }) {
  const C = useTheme();
  // Use View + Text fallback since Image import varies
  const { Image } = require("react-native");
  return (
    <View style={{ position: "relative" }}>
      <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 12, borderWidth: 1.5, borderColor: C.border }} />
    </View>
  );
}

// ─── JobTimeline ───────────────────────────────────────────────────────────
export function JobTimeline({ steps }: { steps: Array<{ label: string; time?: string; done: boolean; active?: boolean; color: string }> }) {
  const C = useTheme();
  return (
    <View>
      {steps.map((step, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: i < steps.length - 1 ? 0 : 0 }}>
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: step.done ? step.color + "25" : C.bg2, borderWidth: 2, borderColor: step.done || step.active ? step.color : C.border, alignItems: "center", justifyContent: "center" }}>
              {step.done && <Text style={{ color: step.color, fontSize: 10, fontFamily: FONTS.bold }}>✓</Text>}
              {step.active && !step.done && <PulseDot color={step.color} size={4} />}
            </View>
            {i < steps.length - 1 && (
              <View style={{ width: 2, height: 24, backgroundColor: step.done ? step.color + "40" : C.border, marginTop: 2 }} />
            )}
          </View>
          <View style={{ flex: 1, paddingTop: 3, paddingBottom: i < steps.length - 1 ? 24 : 0 }}>
            <Text style={{ color: step.done || step.active ? C.text1 : C.text3, fontFamily: step.active ? FONTS.bold : FONTS.regular, fontSize: 13 }}>{step.label}</Text>
            {step.time && <Text style={{ color: C.text3, fontFamily: FONTS.regular, fontSize: 11, marginTop: 2 }}>{step.time}</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────────
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <Text style={{ color: C.text1, fontFamily: FONTS.bold, fontSize: 18 }}>{title}</Text>
      {action && onAction && (
        <Pressable onPress={onAction}>
          <Text style={{ color: C.primary, fontFamily: FONTS.semibold, fontSize: 13 }}>{action} →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────
export function ThemedInput({ label, ...props }: { label?: string } & React.ComponentProps<typeof TextInput>) {
  const C = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label && <Text style={{ color: C.text2, fontFamily: FONTS.medium, fontSize: 13, marginBottom: 7 }}>{label}</Text>}
      <TextInput
        placeholderTextColor={C.text3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ backgroundColor: C.bg1, borderRadius: 14, borderWidth: 1.5, borderColor: focused ? C.primary : C.border, color: C.text1, fontFamily: FONTS.regular, fontSize: 15, paddingVertical: 14, paddingHorizontal: 16 }}
        {...props}
      />
    </View>
  );
}
