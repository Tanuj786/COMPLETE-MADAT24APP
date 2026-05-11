import React, { useEffect, useRef } from "react";
import { View, Animated, ViewStyle } from "react-native";
import { useTheme } from "./index";

/**
 * Shimmer skeleton placeholder for loading states.
 * Pulses opacity between 0.35 and 1.0 on a 1.2 s loop.
 */
export function Skeleton({ width = "100%", height = 14, radius = 8, style }: {
  width?: number | `${number}%`; height?: number; radius?: number; style?: ViewStyle;
}) {
  const C = useTheme();
  const op = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.35, duration: 700, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: C.bg2,
          opacity: op,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const C = useTheme();
  return (
    <View style={{ backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.cardBorder, padding: 16, gap: 10, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Skeleton width={48} height={48} radius={14} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width={"70%"} height={14} />
          <Skeleton width={"45%"} height={11} />
        </View>
      </View>
      <Skeleton width={"100%"} height={10} />
      <Skeleton width={"85%"} height={10} />
    </View>
  );
}
