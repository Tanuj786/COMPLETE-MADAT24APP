/**
 * Lightweight toast system for both customer + mechanic apps.
 *
 *   <ToastHost />            // mount once near the root (already in app/_layout)
 *   showToast("Saved", "success")   // anywhere in the app
 *
 * Three kinds: "success" (green), "error" (red), "info" (orange).
 * Auto-dismiss after 2.6 s. Stacks up to 3 visible at once.
 */

import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONTS } from "~/constants";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function showToast(message: string, kind: ToastKind = "info") {
  const t: ToastItem = { id: ++counter, message, kind };
  listeners.forEach(l => l(t));
}

const KIND_CONFIG: Record<ToastKind, { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: "#0F1F14", border: "#22C55E", icon: "✓", color: "#4ADE80" },
  error:   { bg: "#1F0F0F", border: "#EF4444", icon: "✕", color: "#F87171" },
  info:    { bg: "#1A1A1A", border: "#F97316", icon: "•", color: "#F97316" },
};

function ToastCard({ toast, onDone }: { toast: ToastItem; onDone: (id: number) => void }) {
  const op = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(-20)).current;
  const cfg = KIND_CONFIG[toast.kind];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(tx, { toValue: 0, tension: 110, friction: 9, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(tx, { toValue: -10, duration: 200, useNativeDriver: true }),
      ]).start(() => onDone(toast.id));
    }, 2600);

    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.card, { opacity: op, transform: [{ translateY: tx }], backgroundColor: cfg.bg, borderColor: cfg.border + "60" }]}>
      <View style={[styles.iconChip, { backgroundColor: cfg.color + "20", borderColor: cfg.color + "60" }]}>
        <Text style={{ color: cfg.color, fontFamily: FONTS.black, fontSize: 14 }}>{cfg.icon}</Text>
      </View>
      <Text style={{ color: "#F0F4FF", fontFamily: FONTS.medium, fontSize: 13, flex: 1, lineHeight: 18 }}>
        {toast.message}
      </Text>
      <Pressable onPress={() => onDone(toast.id)} hitSlop={10}>
        <Text style={{ color: "#5A6A7E", fontFamily: FONTS.bold, fontSize: 16 }}>×</Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (t: ToastItem) =>
      setItems(prev => [...prev.slice(-2), t]); // keep at most 3 visible
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const remove = (id: number) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      {items.map(t => (
        <ToastCard key={t.id} toast={t} onDone={remove} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 14, right: 14,
    gap: 8,
    zIndex: 9999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconChip: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
});
