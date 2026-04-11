/**
 * Route-based i18n helpers.
 *
 * Routes are structured as:
 *   /              → Swedish home
 *   /historical    → Swedish historical
 *   /about         → Swedish about
 *   /en            → English home
 *   /en/historical → English historical
 *   /en/about      → English about
 *
 * This gives each language its own canonical URL for SEO, and lets crawlers
 * index both versions separately. Internal nav components should use
 * `useLocalizedPath` so links preserve the active language.
 */

import { useLocation } from 'react-router-dom';

export type Lang = 'sv' | 'en';
export const SUPPORTED_LANGS: readonly Lang[] = ['sv', 'en'] as const;

/** Strip the `/en` prefix from a path and return the canonical Swedish path. */
export function toSvPath(path: string): string {
  if (path === '/en') return '/';
  if (path.startsWith('/en/')) return path.slice(3);
  return path;
}

/** Detect the active language from a full path. */
export function langFromPath(path: string): Lang {
  if (path === '/en' || path.startsWith('/en/')) return 'en';
  return 'sv';
}

/** Prefix a Swedish path with the language (no-op for sv). */
export function withLangPrefix(path: string, lang: Lang): string {
  const sv = toSvPath(path);
  if (lang === 'sv') return sv;
  if (sv === '/') return '/en';
  return '/en' + sv;
}

/** React hook: returns the active language based on the current URL. */
export function useLang(): Lang {
  const { pathname } = useLocation();
  return langFromPath(pathname);
}

/**
 * React hook: given a canonical Swedish path, return the version in the
 * currently active language. Use this in all internal links so navigation
 * preserves language.
 */
export function useLocalizedPath(): (path: string) => string {
  const lang = useLang();
  return (p: string) => withLangPrefix(p, lang);
}

/** Build the alternate URL for the opposite language, preserving the path. */
export function otherLangPath(currentPath: string): { lang: Lang; path: string } {
  const current = langFromPath(currentPath);
  const other: Lang = current === 'sv' ? 'en' : 'sv';
  return { lang: other, path: withLangPrefix(currentPath, other) };
}
