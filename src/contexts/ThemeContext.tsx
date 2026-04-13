"use client";

/**
 * ThemeContext – SIS-Kompatibilitätsschicht
 * Erkennt den Dark Mode über die CSS-Klasse "dark" auf <html>,
 * wie er vom AppHeader gesetzt wird. Kein Provider nötig.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type DarkMode = "light" | "dark";
export type ColorTheme = string;

export interface ThemeContextType {
  darkMode: DarkMode;
  toggleDarkMode: () => void;
  switchable: boolean;
  theme: DarkMode;
  toggleTheme?: () => void;
  colorTheme?: ColorTheme;
  setColorTheme?: (t: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: DarkMode;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = true,
}: ThemeProviderProps) {
  const [darkMode, setDarkMode] = useState<DarkMode>(defaultTheme);

  useEffect(() => {
    const root = document.documentElement;
    setDarkMode(root.classList.contains("dark") ? "dark" : "light");

    const observer = new MutationObserver(() => {
      setDarkMode(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggleDarkMode = useCallback(() => {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    setDarkMode(next);
  }, []);

  return (
    <ThemeContext.Provider value={{
      darkMode,
      toggleDarkMode,
      switchable,
      theme: darkMode,
      toggleTheme: toggleDarkMode,
      colorTheme: "volt",
      setColorTheme: () => {},
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useTheme – Funktioniert auch OHNE ThemeProvider.
 * Fallback: erkennt Dark Mode über die CSS-Klasse "dark" auf <html>.
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  // Fallback wenn kein Provider vorhanden (SIS-Normalfall)
  const [darkMode, setDarkMode] = useState<DarkMode>("light");

  useEffect(() => {
    if (context) return; // Provider vorhanden, kein Fallback nötig
    const root = document.documentElement;
    setDarkMode(root.classList.contains("dark") ? "dark" : "light");

    const observer = new MutationObserver(() => {
      setDarkMode(root.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [context]);

  if (context) return context;

  return {
    darkMode,
    toggleDarkMode: () => {
      const root = document.documentElement;
      root.classList.toggle("dark");
      setDarkMode(root.classList.contains("dark") ? "dark" : "light");
    },
    switchable: true,
    theme: darkMode,
    toggleTheme: () => {
      const root = document.documentElement;
      root.classList.toggle("dark");
    },
    colorTheme: "volt",
    setColorTheme: () => {},
  };
}
