import React, { useRef, useEffect } from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, Rect, Path, Ellipse, G } from "react-native-svg";

interface Props {
  size?: number;
  animate?: boolean;
}

// Full detailed mechanic character SVG
export function MechanicIcon({ size = 90, animate = true }: Props) {
  const bobAnim   = useRef(new Animated.Value(0)).current;
  const armAnim   = useRef(new Animated.Value(0)).current;
  const wrenchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    // Bob up and down
    Animated.loop(Animated.sequence([
      Animated.timing(bobAnim,    { toValue: -4, duration: 1200, useNativeDriver: true }),
      Animated.timing(bobAnim,    { toValue: 0,  duration: 1200, useNativeDriver: true }),
    ])).start();
    // Arm wave
    Animated.loop(Animated.sequence([
      Animated.timing(armAnim,    { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(armAnim,    { toValue: 0, duration: 900, useNativeDriver: true }),
    ])).start();
    // Wrench spin
    Animated.loop(Animated.sequence([
      Animated.timing(wrenchAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(wrenchAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ])).start();
  }, []);

  const armRotate = armAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "20deg"] });
  const wrenchRotate = wrenchAnim.interpolate({ inputRange: [0, 1], outputRange: ["-15deg", "15deg"] });

  return (
    <Animated.View style={{ transform: [{ translateY: bobAnim }] }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* ── Shadow ── */}
        <Ellipse cx="50" cy="96" rx="22" ry="4" fill="rgba(0,0,0,0.25)" />

        {/* ── Body / Overalls ── */}
        <Rect x="32" y="52" width="36" height="32" rx="8" fill="#1E3A8A" />
        {/* Chest pocket */}
        <Rect x="45" y="55" width="10" height="8" rx="2" fill="#2563EB" />
        {/* Zipper line */}
        <Rect x="49" y="52" width="2" height="32" rx="1" fill="#2563EB" />
        {/* Belt */}
        <Rect x="32" y="63" width="36" height="5" rx="2" fill="#1E2A4A" />
        {/* Belt buckle */}
        <Rect x="45" y="64" width="10" height="3" rx="1" fill="#FFD93D" />

        {/* ── Legs ── */}
        <Rect x="34" y="78" width="12" height="16" rx="4" fill="#1E3A8A" />
        <Rect x="54" y="78" width="12" height="16" rx="4" fill="#1E3A8A" />
        {/* Boots */}
        <Rect x="32" y="88" width="16" height="8" rx="4" fill="#1A1A1A" />
        <Rect x="52" y="88" width="16" height="8" rx="4" fill="#1A1A1A" />

        {/* ── Neck ── */}
        <Rect x="44" y="44" width="12" height="12" rx="3" fill="#FBBF7C" />

        {/* ── Head ── */}
        <Circle cx="50" cy="34" r="18" fill="#FBBF7C" />
        {/* Ear left */}
        <Circle cx="32" cy="34" r="4" fill="#FBBF7C" />
        {/* Ear right */}
        <Circle cx="68" cy="34" r="4" fill="#FBBF7C" />

        {/* ── Hard hat ── */}
        <Ellipse cx="50" cy="22" rx="20" ry="6" fill="#FF8C42" />
        <Path d="M30 22 Q50 8 70 22 Z" fill="#FF8C42" />
        {/* Hat brim */}
        <Rect x="28" y="20" width="44" height="5" rx="2.5" fill="#E04A15" />
        {/* Hat stripe */}
        <Rect x="28" y="20" width="44" height="2" rx="1" fill="#FFD93D" />

        {/* ── Face ── */}
        {/* Eyes */}
        <Circle cx="44" cy="34" r="3" fill="#1A1A2E" />
        <Circle cx="56" cy="34" r="3" fill="#1A1A2E" />
        {/* Eye shine */}
        <Circle cx="45" cy="33" r="1" fill="white" />
        <Circle cx="57" cy="33" r="1" fill="white" />
        {/* Smile */}
        <Path d="M44 41 Q50 46 56 41" stroke="#C97B4A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Stubble dots */}
        <Circle cx="45" cy="43" r="0.8" fill="#C97B4A" opacity="0.5" />
        <Circle cx="50" cy="44" r="0.8" fill="#C97B4A" opacity="0.5" />
        <Circle cx="55" cy="43" r="0.8" fill="#C97B4A" opacity="0.5" />

        {/* ── Left arm (down) ── */}
        <Rect x="21" y="52" width="12" height="28" rx="6" fill="#1E3A8A" />
        {/* Left glove */}
        <Circle cx="27" cy="82" r="7" fill="#1A1A1A" />

        {/* ── Right arm (holding wrench) ── */}
        <G origin="32 60">
          <Rect x="67" y="52" width="12" height="26" rx="6" fill="#1E3A8A" />
          {/* Right glove */}
          <Circle cx="73" cy="80" r="7" fill="#1A1A1A" />
        </G>

        {/* ── Wrench ── */}
        <G>
          {/* Handle */}
          <Rect x="72" y="58" width="6" height="30" rx="3" fill="#9CA3AF" />
          {/* Head */}
          <Path d="M69 56 Q75 50 81 56 L81 62 Q75 58 69 62 Z" fill="#6B7280" />
          <Circle cx="75" cy="58" r="4" fill="#4B5563" />
          <Circle cx="75" cy="58" r="2" fill="#374151" />
        </G>

        {/* ── Tool belt pockets ── */}
        <Rect x="33" y="65" width="7" height="9" rx="2" fill="#1E2A4A" />
        <Circle cx="36.5" cy="69.5" r="2" fill="#FFD93D" />
        <Rect x="60" y="65" width="7" height="9" rx="2" fill="#1E2A4A" />
        <Circle cx="63.5" cy="69.5" r="2" fill="#FF8C42" />

        {/* ── Sparks / stars ── */}
        <Path d="M82 46 L83 44 L84 46 L86 47 L84 48 L83 50 L82 48 L80 47 Z" fill="#FFD93D" opacity="0.9" />
        <Path d="M16 50 L17 48.5 L18 50 L19.5 51 L18 52 L17 53.5 L16 52 L14.5 51 Z" fill="#00D4AA" opacity="0.7" />
      </Svg>
    </Animated.View>
  );
}
