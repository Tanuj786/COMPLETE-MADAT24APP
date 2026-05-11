import { create } from "zustand";
import { buildTheme, type ThemeMode, type AccentColor } from "~/constants";

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  colors: ReturnType<typeof buildTheme>;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setAccent: (a: AccentColor) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark",
  accent: "orange",
  colors: buildTheme("dark", "orange"),

  setMode: (mode) => {
    const colors = buildTheme(mode, get().accent);
    set({ mode, colors });
  },

  toggleMode: () => {
    const newMode: ThemeMode = get().mode === "dark" ? "light" : "dark";
    const colors = buildTheme(newMode, get().accent);
    set({ mode: newMode, colors });
  },

  setAccent: (accent) => {
    const colors = buildTheme(get().mode, accent);
    set({ accent, colors });
  },
}));
