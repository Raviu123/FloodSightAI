"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Language } from "@/locales";

export function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, setLanguage, availableLanguages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangObj =
    availableLanguages.find((l) => l.code === language) || availableLanguages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (code: Language) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="language-selector-button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Change language / ಭಾಷೆಯನ್ನು ಬದಲಾಯಿಸಿ / भाषा बदलें / 言語切り替え"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/90 hover:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 shadow-sm backdrop-blur-md transition-colors focus:outline-hidden focus:ring-1 focus:ring-sky-500 cursor-pointer"
      >
        <Globe className="h-3.5 w-3.5 text-sky-400 shrink-0" />
        <span className="font-mono text-xs font-semibold">{currentLangObj.flag} {currentLangObj.nativeName}</span>
        <ChevronDown
          className={`h-3 w-3 text-zinc-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="language-selector-button"
          className="absolute right-0 mt-1.5 w-44 origin-top-right rounded-xl border border-zinc-800 bg-zinc-950/95 p-1.5 shadow-2xl backdrop-blur-xl z-50 focus:outline-hidden ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-850 mb-1">
            Language / ಭಾಷೆ / भाषा / 言語
          </div>
          {availableLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                role="menuitem"
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/20 text-sky-300 border border-blue-500/30 font-semibold"
                    : "text-zinc-300 hover:bg-zinc-850 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{lang.flag}</span>
                  <div className="flex flex-col text-left">
                    <span className="leading-tight">{lang.nativeName}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{lang.name}</span>
                  </div>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-sky-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
