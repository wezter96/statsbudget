/**
 * Orchestrator for the party-shadow-budget seeding pipeline.
 *
 * Usage:
 *   bun scripts/party-budgets/seed-shadow-budgets.ts \
 *     --years 2024,2025 \
 *     --parties S,M,SD,C,V,KD,MP,L
 *
 * Modes (decided at runtime from env vars):
 *
 *   REAL + LLM + DB (the eventual happy path):
 *     - ANTHROPIC_API_KEY set and USE_STUB != true  -> LLM extraction
 *     - DATABASE_URL set                            -> direct Postgres insert
 *
 *   REAL + LLM + emit-sql (no DB creds):
 *     - same, but no DATABASE_URL -> writes supabase/migrations/*.sql
 *
 *   STUB + DB:
 *     - USE_STUB=true (or no key) -> deterministic stub deltas
 *     - DATABASE_URL set          -> direct Postgres insert
 *
 *   STUB + emit-sql  (what the dev run below uses):
 *     - no key, no db -> writes supabase/migrations/*.sql
 *
 * The default when run with neither ANTHROPIC_API_KEY nor DATABASE_URL is
 * STUB + emit-sql, which is what the dev brief asks for.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listBudgetMotions, pickBudgetMotion, fetchMotionText } from './fetch-motions';
import { extractDeltas } from './extract-deltas';
import { reconcile } from './reconcile';
import { stubExtract } from './stub-extract';
import type { ExtractedDelta, MotionDoc } from './types';

// ------- arg parsing -------

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = 'true';
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const years = (args.years ?? '2024,2025').split(',').map(n => Number(n.trim())).filter(Boolean);
const parties = (args.parties ?? 'S,M,SD,C,V,KD,MP,L').split(',').map(s => s.trim()).filter(Boolean);
const emitSqlOnly = args.emitSql === 'true';
const skipFetch = args.skipFetch === 'true' || (!process.env.ANTHROPIC_API_KEY && process.env.USE_STUB !== 'false');

// ------- hardcoded dim_party / dim_area id lookups -------
//
// These mirror the production seed described in the project brief:
//   dim_party: party_id=1 is GOV; 2..10 are S, M, SD, C, V, KD, MP, L, ALLIANSEN
//   dim_area:  area_id=1..27 correspond to UO01..UO27
//
// The pipeline looks these up from the DB when it has credentials, and
// falls back to these hardcoded values when running in stub/emit-sql mode.

const FALLBACK_PARTY_IDS: Record<string, number> = {
  GOV: 1, S: 2, M: 3, SD: 4, C: 5, V: 6, KD: 7, MP: 8, L: 9, ALLIANSEN: 10,
};

function fallbackAreaId(code: string): number {
  const n = Number(code.replace(/^UO/, ''));
  return n; // UO01 -> 1, ..., UO27 -> 27
}

// ------- per-(year, party) pipeline step -------

interface SeedRow {
  year_id: number;
  area_id: number;
  anslag_id: null;
  party_id: number;
  budget_type: 'shadow_delta';
  amount_nominal_sek: number;
  is_revenue: false;
  // carried for provenance, not written to DB
  _source_quote: string;
  _area_code: string;
  _party_code: string;
}

async function runOne(year: number, partyCode: string): Promise<SeedRow[]> {
  let motion: MotionDoc | null = null;
  let deltas: ExtractedDelta[] = [];
  let declaredTotal: number | undefined;
  let mode: 'stub' | 'llm' = 'stub';

  if (!skipFetch) {
    try {
      const motions = await listBudgetMotions(year, partyCode);
      motion = pickBudgetMotion(year, motions);
      if (motion) {
        motion.text = (await fetchMotionText(motion)) ?? undefined;
        const res = await extractDeltas(motion, year, {});
        deltas = res.deltas;
        declaredTotal = res.declared_total_mkr;
        mode = res.mode;
      }
    } catch (e) {
      console.warn(`[${partyCode} ${year}] fetch/extract failed: ${(e as Error).message}`);
    }
  }

  if (deltas.length === 0) {
    deltas = stubExtract(year, partyCode);
    mode = 'stub';
  }

  const rec = reconcile(deltas, declaredTotal);
  console.log(
    `[${partyCode} ${year}] mode=${mode} kept=${rec.kept.length} dropped=${rec.dropped.length} total=${rec.total_mkr} Mkr` +
    (rec.declared_total_mkr !== undefined ? ` (declared ${rec.declared_total_mkr})` : '')
  );

  const partyId = FALLBACK_PARTY_IDS[partyCode];
  if (!partyId) {
    console.warn(`[${partyCode}] unknown party code, skipping`);
    return [];
  }

  // Convert Mkr -> SEK (raw amount). Schema stores amount_nominal_sek in Mkr
  // per the brief ("All monetary values stored in Mkr as bigint"), so we keep
  // Mkr as-is.
  return rec.kept.map(d => ({
    year_id: year,
    area_id: fallbackAreaId(d.area_code),
    anslag_id: null,
    party_id: partyId,
    budget_type: 'shadow_delta' as const,
    amount_nominal_sek: Math.round(d.delta_mkr),
    is_revenue: false,
    _source_quote: d.source_quote,
    _area_code: d.area_code,
    _party_code: partyCode,
  }));
}

// ------- output adapters -------

async function emitSqlMigration(rows: SeedRow[], scope: { years: number[]; parties: string[] }) {
  const ts = '20260412120000';
  const dir = join(process.cwd(), 'supabase', 'migrations');
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${ts}_shadow_seed.sql`);

  const partyIds = scope.parties.map(p => FALLBACK_PARTY_IDS[p]).filter(Boolean);

  const header = `-- Auto-generated by scripts/party-budgets/seed-shadow-budgets.ts
-- Mode: ${process.env.ANTHROPIC_API_KEY && process.env.USE_STUB !== 'true' ? 'LLM' : 'STUB'}
-- Scope: years=${scope.years.join(',')} parties=${scope.parties.join(',')}
--
-- Seeds shadow_delta rows in fact_budget for party comparison.
-- Idempotent: wipes prior shadow_delta rows for this scope before inserting.

BEGIN;

DELETE FROM fact_budget
 WHERE budget_type = 'shadow_delta'
   AND year_id = ANY(ARRAY[${scope.years.join(',')}])
   AND party_id = ANY(ARRAY[${partyIds.join(',')}]);

`;

  const values = rows.map((r, i) => {
    const q = r._source_quote.replace(/'/g, "''").slice(0, 240);
    const comma = i < rows.length - 1 ? ',' : '';
    return `  (${r.year_id}, ${r.area_id}, NULL, ${r.party_id}, 'shadow_delta', ${r.amount_nominal_sek}, FALSE)${comma} -- ${r._party_code} ${r._area_code}: ${q}`;
  }).join('\n');

  const insert = `INSERT INTO fact_budget
  (year_id, area_id, anslag_id, party_id, budget_type, amount_nominal_sek, is_revenue)
VALUES
${values}
;

COMMIT;
`;

  await writeFile(path, header + insert);
  console.log(`\nWrote ${rows.length} rows to ${path}`);
}

async function insertIntoDb(rows: SeedRow[], scope: { years: number[]; parties: string[] }) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');

  // Bun ships a native Postgres client: Bun.SQL
  // @ts-ignore - Bun global
  const sql = new Bun.SQL(normalizePgUrl(url));
  const partyIds = scope.parties.map(p => FALLBACK_PARTY_IDS[p]).filter(Boolean);

  try {
    await sql.begin(async (tx: any) => {
      await tx`
        DELETE FROM fact_budget
         WHERE budget_type = 'shadow_delta'
           AND year_id = ANY(${scope.years})
           AND party_id = ANY(${partyIds})
      `;
      for (const r of rows) {
        await tx`
          INSERT INTO fact_budget
            (year_id, area_id, anslag_id, party_id, budget_type, amount_nominal_sek, is_revenue)
          VALUES
            (${r.year_id}, ${r.area_id}, NULL, ${r.party_id}, 'shadow_delta', ${r.amount_nominal_sek}, FALSE)
        `;
      }
    });
    console.log(`Inserted ${rows.length} rows into fact_budget`);
  } finally {
    await sql.end?.();
  }
}

function normalizePgUrl(raw: string): string {
  // follow the same convention as scripts/seed.ts: force sslmode=require
  const u = new URL(raw);
  if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
  return u.toString();
}

// ------- main -------

async function main() {
  console.log(`Seeding party shadow budgets: years=${years.join(',')} parties=${parties.join(',')}`);
  console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'set' : 'missing (stub mode)'}`);
  console.log(`  DATABASE_URL:      ${process.env.DATABASE_URL ? 'set' : 'missing (emit-sql mode)'}`);
  console.log(`  USE_STUB:          ${process.env.USE_STUB ?? '(auto)'}`);

  const allRows: SeedRow[] = [];
  for (const y of years) {
    for (const p of parties) {
      const rows = await runOne(y, p);
      allRows.push(...rows);
    }
  }

  console.log(`\nTotal rows: ${allRows.length}`);

  if (emitSqlOnly || !process.env.DATABASE_URL) {
    await emitSqlMigration(allRows, { years, parties });
  } else {
    await insertIntoDb(allRows, { years, parties });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
