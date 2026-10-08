"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import {
  Language,
  LanguageOption,
  TranslationSchema,
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  translations,
} from "@/locales";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationSchema;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "floodshield_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedLang = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (savedLang && (savedLang === "en" || savedLang === "hi" || savedLang === "kn" || savedLang === "ja")) {
        setLanguageState(savedLang);
        document.documentElement.lang = savedLang;
      }
    } catch {
      // localStorage may not be available
    }
  }, []);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      if (typeof document !== "undefined") {
        document.documentElement.lang = newLang;
      }
    } catch {
      // ignore
    }
  };

  const t = useMemo(() => {
    return translations[language] || translations[DEFAULT_LANGUAGE];
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      availableLanguages: AVAILABLE_LANGUAGES,
    }),
    [language, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return safe fallback for testing or SSR without provider
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: translations[DEFAULT_LANGUAGE],
      availableLanguages: AVAILABLE_LANGUAGES,
    };
  }
  return context;
}
