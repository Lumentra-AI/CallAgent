"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  ReactNode,
} from "react";

// ============================================================================
// MOUNTED STORE - For hydration-safe mounting detection
// ============================================================================

const mountedSubscribe = () => () => {};
const getMountedSnapshot = () => true;
const getMountedServerSnapshot = () => false;

// ============================================================================
// TYPES
// ============================================================================

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// ============================================================================
// STORAGE KEY
// ============================================================================

const THEME_STORAGE_KEY = "lumentra_theme";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

// Helper to get initial theme from localStorage
function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const savedTheme = localStorage.getItem(
    THEME_STORAGE_KEY,
  ) as ThemeMode | null;
  return savedTheme && ["light", "dark", "system"].includes(savedTheme)
    ? savedTheme
    : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Use lazy initializer to avoid setState in effect
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(getInitialTheme()),
  );

  // Use useSyncExternalStore for hydration-safe mounted detection
  // This avoids setState in effect while still preventing hydration mismatch
  const mounted = useSyncExternalStore(
    mountedSubscribe,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === "system") {
        setResolvedTheme(e.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mounted, theme]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    if (resolvedTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }

    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, resolvedTheme, mounted]);

  // Update both theme and resolved theme together to avoid setState in effect
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      // Cycle through: light -> dark -> system -> light
      const newTheme =
        prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      setResolvedTheme(resolveTheme(newTheme));
      return newTheme;
    });
  }, []);

  const isDark = resolvedTheme === "dark";

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
      isDark,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme, isDark],
  );

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
