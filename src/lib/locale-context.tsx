"use client";

/**
 * LocaleProvider — single source of truth for the active UI locale
 * (de/en) and a `useT()` hook bound to it.
 *
 * 2026-04-18: `useT()` was added as part of the i18n rewrite so that
 * components can drop `de ? ... : ...` ternaries in favour of
 * `t('namespace.key')` calls without threading locale through props.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { t as translate, type Locale, type TranslationKey } from "./i18n";

const STORAGE_KEY = "sis-locale";

interface LocaleContextType {
  locale: Locale;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "de",
  toggleLocale: () => {},
});

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "de";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" ? "en" : "de";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);

  // Persist to localStorage & update <html lang="…"> on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

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

/**
 * Hook that returns a `t()` function bound to the current locale and
 * a stable `de` boolean for call sites that still use the ternary
 * shape (e.g. date-formatting edge cases). Prefer `t(...)` over
 * `de ? ... : ...` for any new code.
 *
 * Usage:
 * ```tsx
 * const { t, locale } = useT();
 * <button>{t('common.cancel')}</button>
 * <span>{t('admin.archiveTenantQ', { name: tenant.name })}</span>
 * ```
 */
export function useT() {
  const { locale } = useContext(LocaleContext);
  const t = useMemo(
    () => (key: TranslationKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale],
  );
  return { t, locale, de: locale === "de" };
}
