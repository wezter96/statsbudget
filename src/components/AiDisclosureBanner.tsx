import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocalizedPath } from '@/lib/lang-route';

const STORAGE_KEY = 'statsbudget-ai-disclosure-dismissed-v1';

/**
 * One-time dismissible banner explaining that Statsbudget is AI-assisted.
 * Appears under the hero on first visit. Dismissal persists in localStorage.
 * No cookies — aligned with "no cookie banner" policy.
 */
const AiDisclosureBanner = () => {
  const { t } = useTranslation();
  const loc = useLocalizedPath();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage disabled — just show each visit, no persistence
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } catch {
      /* ignore */
    }
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t('banner.aria') as string}
      className="border-b border-border bg-amber-50/70"
    >
      <div className="container flex items-start gap-3 py-3">
        <Bot className="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
        <div className="flex-1 text-sm text-amber-950">
          <p className="leading-relaxed">
            <strong className="font-semibold">{t('banner.heading')}</strong>{' '}
            {t('banner.body')}{' '}
            <Link
              to={loc('/about') + '#rapportera-fel'}
              className="font-medium underline underline-offset-2 hover:text-amber-900"
            >
              {t('banner.cta')}
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md p-1 text-amber-900/70 transition-colors hover:bg-amber-100 hover:text-amber-900"
          aria-label={t('banner.dismiss') as string}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AiDisclosureBanner;
