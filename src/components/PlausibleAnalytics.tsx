import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPlausibleConfig } from '@/lib/site-runtime';

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { u?: string }) => void;
  }
}

const PlausibleAnalytics = () => {
  const location = useLocation();
  const hasTrackedInitialPageview = useRef(false);
  const plausibleConfig = getPlausibleConfig();
  const plausibleDomain = plausibleConfig?.domain;
  const plausibleScriptSrc = plausibleConfig?.scriptSrc;

  useEffect(() => {
    if (!plausibleDomain || !plausibleScriptSrc) return;

    const selector = `script[data-domain="${plausibleDomain}"][src="${plausibleScriptSrc}"]`;
    if (document.querySelector(selector)) return;

    const script = document.createElement('script');
    script.defer = true;
    script.setAttribute('data-domain', plausibleDomain);
    script.src = plausibleScriptSrc;
    document.head.appendChild(script);
  }, [plausibleDomain, plausibleScriptSrc]);

  useEffect(() => {
    if (!plausibleDomain) return;
    if (!hasTrackedInitialPageview.current) {
      hasTrackedInitialPageview.current = true;
      return;
    }
    if (typeof window.plausible !== 'function') return;

    window.plausible('pageview', { u: window.location.href });
  }, [location.pathname, location.search, plausibleDomain]);

  return null;
};

export default PlausibleAnalytics;
