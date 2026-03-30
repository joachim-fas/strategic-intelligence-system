"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Locale } from "./i18n";

interface LocaleContextType {
  locale: Locale;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "de",
  toggleLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("de");

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "de" ? "en" : "de"));
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, toggleLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
