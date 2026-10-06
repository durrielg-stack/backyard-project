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

export const THEME_CYCLE: ThemeMode[] = ["dark", "light", "m3dark", "m3light"];
const CYCLE = THEME_CYCLE;

interface ThemeContextValue {
  T: ThemeTokens;
  mode: ThemeMode;
  isDark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  T: THEME,
  mode: "dark",
  isDark: true,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("bp-theme") as ThemeMode | null;
    if (saved && (CYCLE as string[]).includes(saved))
      setMode(saved as ThemeMode);
  }, []);

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
