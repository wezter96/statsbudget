/**
 * Fetches budget motion listings and full text from the Riksdagen open data API.
 *
 * See SOURCES.md for endpoint docs. All network access is isolated here so the
 * rest of the pipeline can be tested with a cache or a stub.
 */

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { MotionDoc } from './types';

// @ts-ignore - Bun provides import.meta.dir
const CACHE_ROOT = join((import.meta as any).dir ?? process.cwd(), 'scripts', 'party-budgets', '.cache');

function rmTag(year: number): string {
  // fall budget for year X is filed in riksmöte (X-1)/(X%100)
  const prev = year - 1;
  const yy = String(year).slice(-2).padStart(2, '0');
  return `${prev}/${yy}`;
}

async function exists(path: string) {
  try { await stat(path); return true; } catch { return false; }
}

async function cachedFetch(url: string, cachePath: string): Promise<string> {
  if (await exists(cachePath)) {
    return readFile(cachePath, 'utf-8');
  }
  const res = await fetch(url, {
    headers: { 'user-agent': 'statsbudget-pipeline/0.1 (+github.com/statsbudget)' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const body = await res.text();
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body);
  return body;
}

function normalizeUrl(protoRelative: string | undefined): string | null {
  if (!protoRelative) return null;
  if (protoRelative.startsWith('//')) return 'https:' + protoRelative;
  if (protoRelative.startsWith('http')) return protoRelative;
  return null;
}

export async function listBudgetMotions(year: number, partyCode: string): Promise<MotionDoc[]> {
  const rm = rmTag(year);
  const rmEnc = encodeURIComponent(rm);
  const url =
    `https://data.riksdagen.se/dokumentlista/` +
    `?sok=${encodeURIComponent('med anledning av budgetpropositionen')}` +
    `&doktyp=mot&parti=${partyCode}&rm=${rmEnc}&utformat=json&sz=50`;

  const cachePath = join(CACHE_ROOT, rm.replace('/', '_'), partyCode, `_list.json`);
  const raw = await cachedFetch(url, cachePath);

  let parsed: any;
  try { parsed = JSON.parse(raw); }
  catch (e) { throw new Error(`Bad JSON from ${url}: ${(e as Error).message}`); }

  const docs: any[] = parsed?.dokumentlista?.dokument ?? [];
  return docs.map((d): MotionDoc => ({
    dok_id: String(d.dok_id),
    rm: String(d.rm ?? rm),
    party_code: partyCode,
    titel: String(d.titel ?? ''),
    undertitel: String(d.undertitel ?? ''),
    datum: String(d.datum ?? ''),
    text_url: normalizeUrl(d.dokument_url_text),
    html_url: normalizeUrl(d.dokument_url_html),
  }));
}

/** Pick the single motion most likely to BE the shadow budget */
export function pickBudgetMotion(year: number, motions: MotionDoc[]): MotionDoc | null {
  const prev = year - 1;
  const yy = String(year).slice(-2).padStart(2, '0');
  const needle1 = `prop. ${prev}/${yy}:1`;
  const needle2 = `prop. ${prev}/${yy}:100`;

  const byPriority = [
    (m: MotionDoc) => m.titel.includes(needle1),
    (m: MotionDoc) => m.titel.includes(needle2),
    (m: MotionDoc) => m.titel.toLowerCase().includes('budgetpropositionen'),
  ];

  for (const fn of byPriority) {
    const hit = motions.find(fn);
    if (hit) return hit;
  }
  return motions[0] ?? null;
}

export async function fetchMotionText(m: MotionDoc): Promise<string | null> {
  const url = m.text_url ?? m.html_url;
  if (!url) return null;
  const ext = m.text_url ? 'txt' : 'html';
  const cachePath = join(CACHE_ROOT, m.rm.replace('/', '_'), m.party_code, `${m.dok_id}.${ext}`);
  const body = await cachedFetch(url, cachePath);
  if (ext === 'html') {
    // crude strip — extraction prompt will tolerate remaining HTML fine
    return body.replace(/<script[\s\S]*?<\/script>/gi, '')
               .replace(/<style[\s\S]*?<\/style>/gi, '')
               .replace(/<[^>]+>/g, ' ')
               .replace(/\s+/g, ' ')
               .trim();
  }
  return body;
}
