import {
  buildSiteUrl,
  buildSupabaseFunctionUrl,
  getPlausibleScriptSrc,
  getRouterBasename,
  type SiteQueryValue,
  normalizeSiteUrl,
} from './site-config';

function getRuntimeSiteUrl(): string | null {
  const configuredSiteUrl = normalizeSiteUrl(import.meta.env.VITE_SITE_URL);
  if (configuredSiteUrl) return configuredSiteUrl;
  if (typeof window === 'undefined' || !window.location.origin) return null;
  return normalizeSiteUrl(window.location.origin);
}

export const routerBasename = getRouterBasename(import.meta.env.BASE_URL);

export function getCanonicalUrl(pathname: string, search = ''): string | undefined {
  return (
    buildSiteUrl({
      siteUrl: getRuntimeSiteUrl(),
      basePath: import.meta.env.BASE_URL,
      pathname,
      search,
    }) ?? undefined
  );
}

export function getOgImageUrl(query?: Record<string, SiteQueryValue>): string | undefined {
  return (
    buildSupabaseFunctionUrl({
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      functionName: 'og',
      query,
    }) ?? undefined
  );
}

export function getPlausibleConfig(): { domain: string; scriptSrc: string } | null {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN?.trim();
  if (!domain) return null;

  return {
    domain,
    scriptSrc: getPlausibleScriptSrc(import.meta.env.VITE_PLAUSIBLE_SCRIPT_SRC),
  };
}
