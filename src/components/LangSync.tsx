import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '@/lib/lang-route';

/**
 * Switches i18next + `<html lang>` to match the URL's language prefix.
 * Wraps a page element so every route enforces the right language.
 */
const LangSync = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const urlLang = useLang();

  useEffect(() => {
    if (i18n.language !== urlLang) {
      i18n.changeLanguage(urlLang);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = urlLang;
    }
  }, [urlLang, i18n]);

  return <>{children}</>;
};

export default LangSync;
