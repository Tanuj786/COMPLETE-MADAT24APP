import React, { useRef } from "react";
import { Pressable, Animated, PressableProps } from "react-native";
import * as Haptics from "expo-haptics";

interface Props extends Omit<PressableProps, "style"> {
  scaleTo?: number;
  haptic?: "light" | "medium" | "heavy" | "success" | "warning" | "error" | "none";
  style?: any;
}

/**
 * Drop-in replacement for <Pressable>. Adds:
 *   - Spring scale-down on press in/out
 *   - Optional haptic feedback (default: light)
 */
export function PressableScale({
  scaleTo = 0.96, haptic = "light", style, onPressIn, onPressOut, onPress, children, ...rest
}: Props) {
  const sc = useRef(new Animated.Value(1)).current;

  const triggerHaptic = () => {
    if (haptic === "none") return;
    try {
      switch (haptic) {
        case "light":   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
        case "medium":  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
        case "heavy":   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
        case "success": Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
        case "warning": Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
        case "error":   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
      }
    } catch {/* ignore unsupported devices */}
  };

  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        Animated.spring(sc, { toValue: scaleTo, useNativeDriver: true, tension: 380, friction: 14 }).start();
        triggerHaptic();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(sc, { toValue: 1, useNativeDriver: true, tension: 280, friction: 9 }).start();
        onPressOut?.(e);
      }}
      onPress={onPress}
      style={typeof style === "function" ? undefined : style}
    >
      {(state) => (
        <Animated.View style={{ transform: [{ scale: sc }] }}>
          {typeof children === "function" ? children(state) : children}
        </Animated.View>
      )}
    </Pressable>
  );
}
