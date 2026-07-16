// ── Theme System ──────────────────────────────────────────────────
export type ThemeMode = "dark" | "light";
export type AccentColor = "teal" | "orange" | "indigo" | "rose" | "amber";

export const ACCENT_PALETTES: Record<AccentColor, { primary: string; primaryDark: string; primaryDim: string; primaryGlow: string }> = {
  teal:   { primary: "#00D4AA", primaryDark: "#00A882", primaryDim: "#00D4AA18", primaryGlow: "#00D4AA35" },
  orange: { primary: "#F97316", primaryDark: "#EA6C0A", primaryDim: "#F9731620", primaryGlow: "#F9731640" },
  indigo: { primary: "#6C63FF", primaryDark: "#4F46E5", primaryDim: "#6C63FF18", primaryGlow: "#6C63FF35" },
  rose:   { primary: "#F43F5E", primaryDark: "#BE123C", primaryDim: "#F43F5E18", primaryGlow: "#F43F5E35" },
  amber:  { primary: "#F59E0B", primaryDark: "#D97706", primaryDim: "#F59E0B18", primaryGlow: "#F59E0B35" },
};

const SEMANTIC = {
  green:     "#2ECC71",
  greenDark: "#27AE60",
  greenDim:  "#2ECC7115",
  greenGlow: "#2ECC7135",
  red:       "#FF4757",
  redDim:    "#FF475715",
  yellow:    "#FFD93D",
  yellowDim: "#FFD93D15",
  yellowGlow:"#FFD93D35",
  amber:     "#F59E0B",
  amberDim:  "#F59E0B15",
  amberGlow: "#F59E0B35",
  orange:    "#FF8C42",
  orangeDim: "#FF8C4215",
  orangeGlow:"#FF8C4235",
  orangeLight:"#FFA166",
  blue:      "#3B82F6",
  blueDark:  "#1D4ED8",
  blueDim:   "#3B82F615",
  blueGlow:  "#3B82F635",
  purple:    "#9B59B6",
  purpleDim: "#9B59B615",
  indigo:    "#6C63FF",
  indigoDim: "#6C63FF15",
  indigoGlow:"#6C63FF35",
  white:     "#FFFFFF",
  overlay:   "#00000090",
};

export function buildTheme(mode: ThemeMode, accent: AccentColor) {
  const isDark = mode === "dark";
  return {
    // Base — MechaniQ dark palette
    bg:         isDark ? "#0A0A0A" : "#F4F7FB",
    bg1:        isDark ? "#111111" : "#FFFFFF",
    bg2:        isDark ? "#1A1A1A" : "#EEF2F8",
    card:       isDark ? "#141414" : "#FFFFFF",
    cardBorder: isDark ? "#2A2A2A" : "#DDE3EE",
    text1:      isDark ? "#FFFFFF"  : "#111827",
    text2:      isDark ? "#888888"  : "#4B5563",
    text3:      isDark ? "#444444"  : "#9CA3AF",
    border:     isDark ? "#2A2A2A"  : "#DDE3EE",
    divider:    isDark ? "#1E1E1E"  : "#E5EAF2",
    // Accent
    ...ACCENT_PALETTES[accent],
    // Semantic (fixed)
    ...SEMANTIC,
    // isDark flag
    isDark,
  };
}

// Runtime theme — replaced by ThemeStore
export let COLORS = buildTheme("dark", "orange");

export const FONTS = {
  black:    "Outfit_900Black",
  bold:     "Outfit_700Bold",
  semibold: "Outfit_600SemiBold",
  medium:   "Outfit_500Medium",
  regular:  "DMSans_400Regular",
  light:    "DMSans_400Regular",
};

export const SERVICES = [
  { type: "tyre-puncture",      label: "Tyre Puncture",  icon: "CircleDot",     color: "#FF8C42", basePrice: 300  },
  { type: "fuel-delivery",      label: "Fuel Delivery",  icon: "Fuel",          color: "#3B82F6", basePrice: 200  },
  { type: "engine-repair",      label: "Engine Repair",  icon: "Settings",      color: "#FF4757", basePrice: 1500 },
  { type: "brake-repair",       label: "Brake Repair",   icon: "AlertTriangle", color: "#FFD93D", basePrice: 800  },
  { type: "battery-jump-start", label: "Battery Jump",   icon: "Zap",           color: "#00D4AA", basePrice: 400  },
  { type: "towing-services",    label: "Towing",         icon: "Truck",         color: "#9B59B6", basePrice: 1200 },
  { type: "oil-change",         label: "Oil Change",     icon: "Droplets",      color: "#3B82F6", basePrice: 600  },
  { type: "ac-repair",          label: "AC Repair",      icon: "Wind",          color: "#2ECC71", basePrice: 1000 },
] as const;

export const VEHICLES = [
  { type: "car",      label: "Car",      icon: "Car"      },
  { type: "bike",     label: "Bike",     icon: "Bike"     },
  { type: "electric", label: "Electric", icon: "Zap"      },
  { type: "battery",  label: "Battery",  icon: "Battery"  },
  { type: "tyre",     label: "Tyre",     icon: "CircleDot"},
  { type: "general",  label: "General",  icon: "Wrench"   },
] as const;

export const STATUS_CFG: Record<string, { color: string; bg: string; label: string; glow: string }> = {
  pending:       { color: "#FFD93D", bg: "#FFD93D15", label: "Pending",     glow: "#FFD93D30" },
  accepted:      { color: "#3B82F6", bg: "#3B82F615", label: "Accepted",    glow: "#3B82F630" },
  arrived:       { color: "#14B8A6", bg: "#14B8A615", label: "Arrived",     glow: "#14B8A630" },
  "in-progress": { color: "#FF8C42", bg: "#FF8C4215", label: "In Progress", glow: "#FF8C4230" },
  completed:     { color: "#2ECC71", bg: "#2ECC7115", label: "Completed",   glow: "#2ECC7130" },
  cancelled:     { color: "#FF4757", bg: "#FF475715", label: "Cancelled",   glow: "#FF475730" },
};

export const ACCENT_OPTIONS: { key: AccentColor; label: string; hex: string; emoji: string }[] = [
  { key: "teal",   label: "Teal",   hex: "#00D4AA", emoji: "🩵" },
  { key: "orange", label: "Orange", hex: "#FF6B35", emoji: "🧡" },
  { key: "indigo", label: "Indigo", hex: "#6C63FF", emoji: "💜" },
  { key: "rose",   label: "Rose",   hex: "#F43F5E", emoji: "🩷" },
  { key: "amber",  label: "Amber",  hex: "#F59E0B", emoji: "💛" },
];
