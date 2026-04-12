// Idempotent seeder for skatteintakter dim + fact tables.
//
// Usage:
//   DATABASE_URL=postgres://... bun run scripts/skatteintakter/seed-skatteintakter.ts
//
// The seeder is safe to run repeatedly. It TRUNCATES fact_income and
// re-inserts dim_income_title rows via UPSERT, so re-runs converge.
//
// If DATABASE_URL is not set, the script runs in DRY mode: it loads the
// master list and CSV facts, prints what it WOULD insert, and exits 0.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMasterList, loadFacts } from './fetch-skatteintakter.ts';
import type { IncomeTitleDef, IncomeFact } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

interface PgClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
}

async function maybeConnect(): Promise<PgClient | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { Client } = await import('pg').catch(() => {
    throw new Error('pg package not installed. Run: bun add pg');
  });
  const client = new Client({ connectionString: url }) as unknown as PgClient;
  await (client as unknown as { connect: () => Promise<void> }).connect();
  return client;
}

async function applyMigration(client: PgClient): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const sqlPath = resolve(REPO_ROOT, 'supabase', 'migrations', '20260412160000_skatteintakter.sql');
  const sql = await readFile(sqlPath, 'utf8');
  await client.query(sql);
  console.log('[skatteintakter] migration applied');
}

async function seedDim(
  client: PgClient,
  defs: IncomeTitleDef[],
): Promise<void> {
  // First pass: upsert all rows without parent_id (top-level groups)
  const topLevel = defs.filter(d => d.parent_code === null);
  const children = defs.filter(d => d.parent_code !== null);

  for (const d of topLevel) {
    await client.query(
      `insert into public.dim_income_title
        (code, parent_id, name_sv, name_en, description_sv, sort_order)
       values ($1, null, $2, $3, $4, $5)
       on conflict (code) do update set
         parent_id      = null,
         name_sv        = excluded.name_sv,
         name_en        = excluded.name_en,
         description_sv = excluded.description_sv,
         sort_order     = excluded.sort_order`,
      [d.code, d.name_sv, d.name_en, d.description_sv, d.sort_order],
    );
  }

  // Build code -> id map after top-level insert
  const { rows: dimRows } = await client.query(
    'select income_title_id, code from public.dim_income_title',
  );
  const codeToId = new Map<string, number>();
  for (const r of dimRows) codeToId.set(String(r.code), Number(r.income_title_id));

  // Second pass: upsert children with resolved parent_id
  for (const d of children) {
    const parentId = codeToId.get(d.parent_code!);
    if (parentId == null) {
      console.warn(`[skatteintakter] unknown parent_code: ${d.parent_code} for ${d.code}`);
      continue;
    }
    await client.query(
      `insert into public.dim_income_title
        (code, parent_id, name_sv, name_en, description_sv, sort_order)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (code) do update set
         parent_id      = excluded.parent_id,
         name_sv        = excluded.name_sv,
         name_en        = excluded.name_en,
         description_sv = excluded.description_sv,
         sort_order     = excluded.sort_order`,
      [d.code, parentId, d.name_sv, d.name_en, d.description_sv, d.sort_order],
    );
  }

  // Delete stale rows (codes no longer in master list)
  const wantedCodes = defs.map(d => d.code);
  await client.query(
    `delete from public.dim_income_title where code <> all($1::text[])`,
    [wantedCodes],
  );

  console.log(`[skatteintakter] dim seeded: ${defs.length} rows`);
}

async function seedFacts(client: PgClient, facts: IncomeFact[]): Promise<void> {
  if (facts.length === 0) {
    console.warn('[skatteintakter] no facts to seed (CSV missing or empty)');
    return;
  }
  const { rows: codeRows } = await client.query(
    'select income_title_id, code from public.dim_income_title',
  );
  const byCode = new Map<string, number>();
  for (const r of codeRows) byCode.set(String(r.code), Number(r.income_title_id));

  let inserted = 0;
  for (const f of facts) {
    const tid = byCode.get(f.code);
    if (tid == null) {
      console.warn(`[skatteintakter] unknown code in fact: ${f.code}`);
      continue;
    }
    await client.query(
      `insert into public.fact_income (year_id, income_title_id, amount_mkr, is_estimated)
       values ($1, $2, $3, $4)`,
      [f.year, tid, f.amount_mkr, f.is_estimated],
    );
    inserted++;
  }
  console.log(`[skatteintakter] facts seeded: ${inserted}/${facts.length}`);
}

async function main() {
  console.log('[skatteintakter] starting seeder');
  const masterList = await getMasterList();
  const facts = await loadFacts(REPO_ROOT);
  console.log(`[skatteintakter] master list: ${masterList.length}, facts loaded: ${facts.length}`);

  const client = await maybeConnect();
  if (!client) {
    console.log('[skatteintakter] DRY mode (no DATABASE_URL). Would seed:');
    for (const d of masterList.slice(0, 20)) {
      console.log(`  dim  ${d.code.padEnd(10)}  ${(d.parent_code ?? '(root)').padEnd(10)}  ${d.name_sv}`);
    }
    if (masterList.length > 20) console.log(`  ... +${masterList.length - 20} more dim rows`);
    for (const f of facts.slice(0, 20)) {
      console.log(`  fact ${f.year}  ${f.code.padEnd(10)}  ${f.amount_mkr} Mkr  est=${f.is_estimated}`);
    }
    if (facts.length > 20) console.log(`  ... +${facts.length - 20} more facts`);
    return;
  }

  try {
    await applyMigration(client);
    // Truncate facts first so dim deletions don't violate FK constraints
    await client.query('truncate public.fact_income restart identity');
    await seedDim(client, masterList);
    await seedFacts(client, facts);
    console.log('[skatteintakter] done');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[skatteintakter] FAILED:', err);
  process.exit(1);
});
