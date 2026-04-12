export type SiteQueryValue = string | number | boolean | null | undefined;

export const DEFAULT_PLAUSIBLE_SCRIPT_SRC = 'https://plausible.io/js/script.js';

export const STATIC_SITE_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/historical', changefreq: 'monthly', priority: '0.7' },
  { path: '/skatteutgifter', changefreq: 'monthly', priority: '0.7' },
  { path: '/skatteintakter', changefreq: 'monthly', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.5' },
  { path: '/en', changefreq: 'weekly', priority: '0.9' },
  { path: '/en/historical', changefreq: 'monthly', priority: '0.6' },
  { path: '/en/tax-expenditures', changefreq: 'monthly', priority: '0.6' },
  { path: '/en/tax-revenues', changefreq: 'monthly', priority: '0.6' },
  { path: '/en/about', changefreq: 'monthly', priority: '0.4' },
] as const;

export const GITHUB_PAGES_HTML_ROUTES = STATIC_SITE_ROUTES.filter((route) => route.path !== '/').map(
  (route) => route.path,
);

export function normalizeBasePath(basePath?: string | null): string {
  const trimmed = basePath?.trim();
  if (!trimmed || trimmed === '/') return '/';

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function getRouterBasename(basePath?: string | null): string {
  const normalizedBasePath = normalizeBasePath(basePath);
  return normalizedBasePath === '/' ? '/' : normalizedBasePath.slice(0, -1);
}

export function normalizeSiteUrl(siteUrl?: string | null): string | null {
  const trimmed = siteUrl?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
}

function normalizePathname(pathname?: string | null): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function appendBasePath(pathname: string, basePath: string): string {
  if (basePath === '/') return pathname;

  const trimmedBasePath = basePath.slice(0, -1);
  return pathname === '/' ? `${trimmedBasePath}/` : `${trimmedBasePath}${pathname}`;
}

export function buildSiteUrl({
  siteUrl,
  basePath,
  pathname,
  search,
  hash,
}: {
  siteUrl?: string | null;
  basePath?: string | null;
  pathname?: string | null;
  search?: string | null;
  hash?: string | null;
}): string | null {
  const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
  if (!normalizedSiteUrl) return null;

  const normalizedBasePath = normalizeBasePath(basePath);
  const normalizedPathname = appendBasePath(normalizePathname(pathname), normalizedBasePath);
  const url = new URL(normalizedPathname, `${normalizedSiteUrl}/`);

  const trimmedSearch = search?.trim();
  if (trimmedSearch) {
    url.search = trimmedSearch.startsWith('?') ? trimmedSearch : `?${trimmedSearch}`;
  }

  const trimmedHash = hash?.trim();
  if (trimmedHash) {
    url.hash = trimmedHash.startsWith('#') ? trimmedHash : `#${trimmedHash}`;
  }

  return url.toString();
}

export function buildSupabaseFunctionUrl({
  supabaseUrl,
  functionName,
  query,
}: {
  supabaseUrl?: string | null;
  functionName: string;
  query?: Record<string, SiteQueryValue>;
}): string | null {
  const normalizedSupabaseUrl = normalizeSiteUrl(supabaseUrl);
  if (!normalizedSupabaseUrl) return null;

  const url = new URL(`/functions/v1/${functionName}`, `${normalizedSupabaseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

export function getPlausibleScriptSrc(scriptSrc?: string | null): string {
  const trimmed = scriptSrc?.trim();
  return trimmed || DEFAULT_PLAUSIBLE_SCRIPT_SRC;
}

export function buildSitemapXml({
  siteUrl,
  basePath,
}: {
  siteUrl?: string | null;
  basePath?: string | null;
}): string | null {
  const urls = STATIC_SITE_ROUTES.map((route) => {
    const loc = buildSiteUrl({
      siteUrl,
      basePath,
      pathname: route.path,
    });
    if (!loc) return null;

    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      '  </url>',
    ].join('\n');
  }).filter(Boolean);

  if (urls.length === 0) return null;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

export function buildRobotsTxt({
  siteUrl,
  basePath,
}: {
  siteUrl?: string | null;
  basePath?: string | null;
}): string {
  const lines = ['User-agent: *', 'Allow: /'];
  const sitemapUrl = buildSiteUrl({
    siteUrl,
    basePath,
    pathname: '/sitemap.xml',
  });

  if (sitemapUrl) {
    lines.push('', `Sitemap: ${sitemapUrl}`);
  }

  return `${lines.join('\n')}\n`;
}
