import { describe, expect, it } from 'vitest';
import {
  buildRobotsTxt,
  buildSiteUrl,
  buildSitemapXml,
  buildSupabaseFunctionUrl,
  getRouterBasename,
  normalizeBasePath,
} from '@/lib/site-config';

describe('site-config', () => {
  it('normalizes GitHub Pages base paths', () => {
    expect(normalizeBasePath('repo')).toBe('/repo/');
    expect(normalizeBasePath('/repo')).toBe('/repo/');
    expect(getRouterBasename('/repo/')).toBe('/repo');
    expect(getRouterBasename('/')).toBe('/');
  });

  it('builds canonical URLs for a root custom domain', () => {
    expect(
      buildSiteUrl({
        siteUrl: 'https://budget.example.com',
        basePath: '/',
        pathname: '/historical',
      }),
    ).toBe('https://budget.example.com/historical');
  });

  it('builds canonical URLs for a project Pages path', () => {
    expect(
      buildSiteUrl({
        siteUrl: 'https://octocat.github.io/statsbudget',
        basePath: '/statsbudget',
        pathname: '/about',
        search: '?ref=nav',
      }),
    ).toBe('https://octocat.github.io/statsbudget/about?ref=nav');
  });

  it('builds Supabase function URLs', () => {
    expect(
      buildSupabaseFunctionUrl({
        supabaseUrl: 'https://project-ref.supabase.co',
        functionName: 'og',
        query: { historical: 1 },
      }),
    ).toBe('https://project-ref.supabase.co/functions/v1/og?historical=1');
  });

  it('renders sitemap and robots output from the configured site URL', () => {
    const sitemap = buildSitemapXml({
      siteUrl: 'https://budget.example.com',
      basePath: '/',
    });

    expect(sitemap).toContain('<loc>https://budget.example.com/</loc>');
    expect(sitemap).toContain('<loc>https://budget.example.com/about</loc>');
    expect(
      buildRobotsTxt({
        siteUrl: 'https://budget.example.com',
        basePath: '/',
      }),
    ).toContain('Sitemap: https://budget.example.com/sitemap.xml');
  });
});
