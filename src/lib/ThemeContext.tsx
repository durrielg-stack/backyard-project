"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  THEME,
  LIGHT_THEME,
  M3_DARK_THEME,
  M3_LIGHT_THEME,
  type ThemeTokens,
} from "./theme";

export type ThemeMode = "dark" | "light" | "m3dark" | "m3light";

const THEMES: Record<ThemeMode, ThemeTokens> = {
  dark: THEME,
  light: LIGHT_THEME,
  m3dark: M3_DARK_THEME,
  m3light: M3_LIGHT_THEME,
};

export const THEME_NAMES: Record<ThemeMode, string> = {
  dark: "Classic dark",
  light: "Classic light",
  m3dark: "Material dark",
  m3light: "Material light",
};

// Material 3 is the app's look. The classic themes stay defined for a quick
// rollback (put them back in THEME_CYCLE / DEFAULT_MODE) but are not offered.
export const THEME_CYCLE: ThemeMode[] = ["m3dark", "m3light"];
const CYCLE = THEME_CYCLE;
const DEFAULT_MODE: ThemeMode = "m3dark";
// A device that saved a classic theme moves to the matching Material one.
const LEGACY: Partial<Record<string, ThemeMode>> = {
  dark: "m3dark",
  light: "m3light",
};

interface ThemeContextValue {
  T: ThemeTokens;
  mode: ThemeMode;
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  T: THEMES[DEFAULT_MODE],
  mode: DEFAULT_MODE,
  isDark: true,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);

  useEffect(() => {
    const raw = localStorage.getItem("bp-theme");
    const saved = raw ? (LEGACY[raw] ?? raw) : null;
    if (saved && (CYCLE as string[]).includes(saved))
      setMode(saved as ThemeMode);
  }, []);

  // Expose the active design system to global CSS (focus ring, state
  // layers, tabular numerals — see "Material 3" in globals.css).
  useEffect(() => {
    const T = THEMES[mode];
    const root = document.documentElement;
    if (T.m3) {
      root.dataset.ds = "m3";
      root.style.setProperty("--m3-focus", T.m3.secondary);
      root.style.colorScheme = mode === "m3light" ? "light" : "dark";
    } else {
      delete root.dataset.ds;
      root.style.removeProperty("--m3-focus");
      root.style.removeProperty("color-scheme");
    }
  }, [mode]);

  function toggle() {
    setMode((current) => {
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      localStorage.setItem("bp-theme", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider
      value={{
        T: THEMES[mode],
        mode,
        isDark: mode === "dark" || mode === "m3dark",
        toggle,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
