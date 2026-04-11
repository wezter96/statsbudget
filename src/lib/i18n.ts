import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import sv from '@/locales/sv.json';
import en from '@/locales/en.json';

const STORAGE_KEY = 'statsbudget-lang';
const SUPPORTED = ['sv', 'en'] as const;
type Lang = (typeof SUPPORTED)[number];

function resolveInitial(): Lang {
  if (typeof window === 'undefined') return 'sv';
  // Route-based: if the URL starts with /en, boot English. LangSync keeps it
  // in sync on navigation. localStorage is only consulted as a hint for `/`
  // (and only for English redirect consideration if we add one later).
  try {
    const path = window.location.pathname;
    if (path === '/en' || path.startsWith('/en/')) return 'en';
  } catch {
    /* ignore */
  }
  return 'sv';
}

i18n.use(initReactI18next).init({
  resources: {
    sv: { translation: sv },
    en: { translation: en },
  },
  lng: resolveInitial(),
  fallbackLng: 'sv',
  supportedLngs: SUPPORTED as unknown as string[],
  returnObjects: true,
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, lng);
    if (typeof document !== 'undefined') document.documentElement.lang = lng;
  } catch {
    /* ignore */
  }
});

// Sync initial html lang attribute
if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language || 'sv';
}

export default i18n;
