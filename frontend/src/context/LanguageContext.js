import React, { createContext, useContext, useState, useCallback } from 'react';
import translations from '../utils/translations';

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('app_lang') || 'hi');

  const changeLang = useCallback((code) => {
    setLang(code);
    localStorage.setItem('app_lang', code);
  }, []);

  const t = useCallback((key, params) => {
    let text = translations[lang]?.[key] || translations['hi']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, v);
      });
    }
    return text;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLang = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLang must be used within LanguageProvider');
  return context;
};
