import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ar } from './locales/ar';
import { en } from './locales/en';

export type Language = 'ar' | 'en';
export type TranslationKey = keyof typeof ar;

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    if (saved === 'ar' || saved === 'en') return saved;
    return 'ar';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('app_language', newLang);
  };

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    if (lang === 'en') {
      document.documentElement.classList.add('en');
    } else {
      document.documentElement.classList.remove('en');
    }
  }, [lang, dir]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const translations = lang === 'ar' ? ar : en;
    let text = translations[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      });
    }

    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
