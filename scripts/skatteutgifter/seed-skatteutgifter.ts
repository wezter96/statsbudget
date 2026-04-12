// Idempotent seeder for skatteutgifter dim + fact tables.
//
// Usage:
//   DATABASE_URL=postgres://... bun run scripts/skatteutgifter/seed-skatteutgifter.ts
//
// The seeder is safe to run repeatedly. It TRUNCATES fact_skatteutgift and
// re-inserts dim_skatteutgift rows via UPSERT, so re-runs converge.
//
// If DATABASE_URL is not set, the script runs in DRY mode: it loads the
// master list and (optional) CSV facts, prints what it WOULD insert, and
// exits 0.

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMasterList, loadFacts } from './fetch-skatteutgifter.ts';
import type { SkatteutgiftDef, SkatteutgiftFact } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

interface PgClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  end: () => Promise<void>;
}

async function maybeConnect(): Promise<PgClient | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // Lazy import so DRY mode doesn't require pg installed.
  const { Client } = await import('pg').catch(() => {
    throw new Error('pg package not installed. Run: bun add pg');
  });
  const client = new Client({ connectionString: url }) as unknown as PgClient;
  await (client as unknown as { connect: () => Promise<void> }).connect();
  return client;
}

async function resolveAreaIds(client: PgClient): Promise<Map<string, number>> {
  const { rows } = await client.query('select area_id, code from public.dim_area');
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(String(r.code), Number(r.area_id));
  }
  return map;
}

async function applyMigration(client: PgClient): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  const sqlPath = resolve(REPO_ROOT, 'supabase', 'migrations', '20260412140000_skatteutgifter.sql');
  const sql = await readFile(sqlPath, 'utf8');
  await client.query(sql);
  console.log('[skatteutgifter] migration applied');
}

async function seedDim(
  client: PgClient,
  defs: SkatteutgiftDef[],
  areaIds: Map<string, number>,
): Promise<void> {
  // Delete stale dim rows first (items removed from master list across runs).
  // fact_skatteutgift is truncated upstream, so no FK violations.
  const wantedIds = defs.map(d => d.skatteutgift_id);
  await client.query(
    `delete from public.dim_skatteutgift where skatteutgift_id <> all($1::int[])`,
    [wantedIds],
  );
  for (const d of defs) {
    const areaId = d.thematic_area_code ? areaIds.get(d.thematic_area_code) ?? null : null;
    await client.query(
      `insert into public.dim_skatteutgift
        (skatteutgift_id, code, name_sv, name_en, description_sv, description_en, thematic_area_id, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (skatteutgift_id) do update set
         code             = excluded.code,
         name_sv          = excluded.name_sv,
         name_en          = excluded.name_en,
         description_sv   = excluded.description_sv,
         description_en   = excluded.description_en,
         thematic_area_id = excluded.thematic_area_id,
         sort_order       = excluded.sort_order`,
      [
        d.skatteutgift_id,
        d.code,
        d.name_sv,
        d.name_en,
        d.description_sv,
        d.description_en,
        areaId,
        d.sort_order,
      ],
    );
  }
  console.log(`[skatteutgifter] dim seeded: ${defs.length} rows`);
}

async function seedFacts(client: PgClient, facts: SkatteutgiftFact[]): Promise<void> {
  if (facts.length === 0) {
    console.warn('[skatteutgifter] no facts to seed (CSV missing or empty)');
    return;
  }
  const { rows: codeRows } = await client.query(
    'select skatteutgift_id, code from public.dim_skatteutgift',
  );
  const byCode = new Map<string, number>();
  for (const r of codeRows) byCode.set(String(r.code), Number(r.skatteutgift_id));

  let inserted = 0;
  for (const f of facts) {
    const sid = byCode.get(f.code);
    if (sid == null) {
      console.warn(`[skatteutgifter] unknown code in fact: ${f.code}`);
      continue;
    }
    await client.query(
      `insert into public.fact_skatteutgift (year_id, skatteutgift_id, amount_mkr, is_estimated)
       values ($1,$2,$3,$4)`,
      [f.year, sid, f.amount_mkr, f.is_estimated],
    );
    inserted++;
  }
  console.log(`[skatteutgifter] facts seeded: ${inserted}/${facts.length}`);
}

async function main() {
  console.log('[skatteutgifter] starting seeder');
  const masterList = await getMasterList();
  const facts = await loadFacts(REPO_ROOT);
  console.log(`[skatteutgifter] master list: ${masterList.length}, facts loaded: ${facts.length}`);

  const client = await maybeConnect();
  if (!client) {
    console.log('[skatteutgifter] DRY mode (no DATABASE_URL). Would seed:');
    for (const d of masterList.slice(0, 20)) {
      console.log(`  dim  ${d.skatteutgift_id.toString().padStart(4)}  ${d.code.padEnd(20)}  ${d.name_sv}`);
    }
    if (masterList.length > 20) console.log(`  ... +${masterList.length - 20} more dim rows`);
    for (const f of facts.slice(0, 20)) {
      console.log(`  fact ${f.year}  ${f.code.padEnd(20)}  ${f.amount_mkr} Mkr  est=${f.is_estimated}`);
    }
    if (facts.length > 20) console.log(`  ... +${facts.length - 20} more facts`);
    return;
  }

  try {
    await applyMigration(client);
    const areaIds = await resolveAreaIds(client);
    // Truncate facts first so seedDim can safely delete stale dim rows.
    await client.query('truncate public.fact_skatteutgift restart identity');
    await seedDim(client, masterList, areaIds);
    await seedFacts(client, facts);
    console.log('[skatteutgifter] done');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[skatteutgifter] FAILED:', err);
  process.exit(1);
});
