#!/usr/bin/env bun
/**
 * Seed historical snapshots (1975/76, 1980/81, 1985/86, 1990/91, 1995/96).
 *
 * Source: .planning/historical-seed.json (produced by research agent).
 * Skips any row flagged `uncertain: true` with an obvious extraction bug
 * (e.g. 1985 "Kungl hov... 31468" which should be ~30).
 *
 * Usage: DATABASE_URL=... bun scripts/seed-historical.ts
 */

import { SQL } from 'bun';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set.');
  process.exit(1);
}

function normalizePgUrl(raw: string): string {
  const m = /^(postgres(?:ql)?:\/\/)([^@\s]+)@(.+)$/s.exec(raw);
  if (!m) return raw;
  const [, s, ui, rest] = m;
  const c = ui.indexOf(':');
  if (c < 0) return raw;
  const u = ui.slice(0, c);
  const p = ui.slice(c + 1);
  const enc = /[^A-Za-z0-9\-._~]/.test(p) && !/%[0-9A-Fa-f]{2}/.test(p) ? encodeURIComponent(p) : p;
  return `${s}${u}:${enc}@${rest}`;
}

const normalized = normalizePgUrl(DATABASE_URL);
const withSsl = normalized.includes('sslmode=') ? normalized : normalized + (normalized.includes('?') ? '&' : '?') + 'sslmode=require';
const sql = new SQL(withSsl);

interface HistoricalYear {
  fiscal_year_label: string;
  total_mkr: number;
  total_mkr_proposition?: number;
  breakdown: { name_sv: string; mkr: number; uncertain?: boolean }[];
  source_url: string;
  source_title: string;
  context_sv: string;
  caveats?: string[];
}
type Seed = Record<string, HistoricalYear> & {
  _meta: { confidence: Record<string, string> };
};

async function main() {
  console.log('== Historical seed ==');

  const migration = await Bun.file(
    new URL('../supabase/migrations/20260411180000_historical.sql', import.meta.url),
  ).text();
  console.log('→ applying historical migration');
  await sql.unsafe(migration);

  const json = (await Bun.file('.planning/historical-seed.json').json()) as Seed;

  await sql.begin(async (tx: any) => {
    // Fresh reseed
    await tx.unsafe('delete from public.fact_historical');

    const years = Object.keys(json)
      .filter((key) => key !== '_meta')
      .map((key) => parseInt(key, 10))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);

    for (const year of years) {
      const yearStr = String(year);
      const entry = json[yearStr];
      if (!entry) continue;

      // Update dim_year metadata (dim_year already has these years from the main seed)
      const confidence = json._meta.confidence[yearStr] ?? null;
      await tx.unsafe(
        `update public.dim_year
         set historical_context_sv = $1,
             historical_source_url = $2,
             historical_source_title = $3,
             historical_confidence = $4,
             fiscal_year_label = $5,
             is_historical = true
         where year_id = $6`,
        [entry.context_sv, entry.source_url, entry.source_title, confidence, entry.fiscal_year_label, year],
      );

      // Filter out extraction-bug rows
      const rows = entry.breakdown.filter((r) => {
        // Skip the known 1985 Kungl hov extraction glitch (31468 Mkr — should be ~30)
        if (year === 1985 && r.uncertain && r.mkr > 100) return false;
        return true;
      });

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        await tx.unsafe(
          `insert into public.fact_historical(year_id, category_sv, sort_order, amount_mkr, is_uncertain)
           values ($1, $2, $3, $4, $5)`,
          [year, r.name_sv, i, r.mkr, r.uncertain ?? false],
        );
      }
      console.log(`  ${yearStr}: ${rows.length} rows seeded`);
    }
  });

  await sql.end();
  console.log('== Done ==');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
