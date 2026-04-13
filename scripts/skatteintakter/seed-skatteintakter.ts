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
import { fetchIncomeOutcomeSnapshot } from './fetch-income-outcomes.ts';
import type {
  IncomeFact,
  IncomeOutcomeMonthFact,
  IncomeOutcomeTitleDef,
  IncomeTitleDef,
} from './types.ts';

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
  const migrationPaths = [
    '20260412160000_skatteintakter.sql',
    '20260412223000_income_outcomes.sql',
  ];
  for (const migrationPath of migrationPaths) {
    const sqlPath = resolve(REPO_ROOT, 'supabase', 'migrations', migrationPath);
    const sql = await readFile(sqlPath, 'utf8');
    await client.query(sql);
    console.log(`[skatteintakter] migration applied: ${migrationPath}`);
  }
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

async function ensureDimYears(client: PgClient, years: number[]): Promise<void> {
  const uniqueYears = [...new Set(years)].sort((left, right) => left - right);
  if (uniqueYears.length === 0) return;

  const { rows } = await client.query(
    'select year_id from public.dim_year where year_id = any($1::int[])',
    [uniqueYears],
  );
  const existingYears = new Set(rows.map((row) => Number(row.year_id)));
  const missingYears = uniqueYears.filter((year) => !existingYears.has(year));

  for (const year of missingYears) {
    await client.query(
      `insert into public.dim_year (year_id, cpi_index, gdp_nominal_sek, is_historical)
       values ($1, null, null, false)
       on conflict (year_id) do nothing`,
      [year],
    );
  }

  if (missingYears.length > 0) {
    console.log(`[skatteintakter] inserted missing dim_year rows: ${missingYears.join(', ')}`);
  }
}

async function seedOutcomeDim(client: PgClient, defs: IncomeOutcomeTitleDef[]): Promise<void> {
  const topLevel = defs.filter((definition) => definition.parent_code === null);
  const children = defs.filter((definition) => definition.parent_code !== null);

  for (const definition of topLevel) {
    await client.query(
      `insert into public.dim_income_outcome_title
        (code, parent_id, name_sv, level_key, sort_order)
       values ($1, null, $2, $3, $4)
       on conflict (code) do update set
         parent_id   = null,
         name_sv     = excluded.name_sv,
         level_key   = excluded.level_key,
         sort_order  = excluded.sort_order`,
      [definition.code, definition.name_sv, definition.level_key, definition.sort_order],
    );
  }

  const { rows: dimRows } = await client.query(
    'select income_outcome_title_id, code from public.dim_income_outcome_title',
  );
  const codeToId = new Map<string, number>();
  for (const row of dimRows) {
    codeToId.set(String(row.code), Number(row.income_outcome_title_id));
  }

  for (const definition of children) {
    const parentId = codeToId.get(definition.parent_code!);
    if (parentId == null) {
      console.warn(`[skatteintakter] unknown monthly parent_code: ${definition.parent_code} for ${definition.code}`);
      continue;
    }
    await client.query(
      `insert into public.dim_income_outcome_title
        (code, parent_id, name_sv, level_key, sort_order)
       values ($1, $2, $3, $4, $5)
       on conflict (code) do update set
         parent_id   = excluded.parent_id,
         name_sv     = excluded.name_sv,
         level_key   = excluded.level_key,
         sort_order  = excluded.sort_order`,
      [definition.code, parentId, definition.name_sv, definition.level_key, definition.sort_order],
    );
  }

  await client.query(
    `delete from public.dim_income_outcome_title where code <> all($1::text[])`,
    [defs.map((definition) => definition.code)],
  );

  console.log(`[skatteintakter] monthly dim seeded: ${defs.length} rows`);
}

async function seedOutcomeFacts(client: PgClient, facts: IncomeOutcomeMonthFact[]): Promise<void> {
  if (facts.length === 0) {
    console.warn('[skatteintakter] no monthly income outcome facts to seed');
    return;
  }

  const { rows: codeRows } = await client.query(
    'select income_outcome_title_id, code from public.dim_income_outcome_title',
  );
  const codeToId = new Map<string, number>();
  for (const row of codeRows) {
    codeToId.set(String(row.code), Number(row.income_outcome_title_id));
  }

  let inserted = 0;
  for (const fact of facts) {
    const titleId = codeToId.get(fact.code);
    if (titleId == null) {
      console.warn(`[skatteintakter] unknown monthly income code in fact: ${fact.code}`);
      continue;
    }
    await client.query(
      `insert into public.fact_income_outcome_month
        (year_id, month_id, income_outcome_title_id, amount_mkr, source_year, source_month, source_status)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        fact.year,
        fact.month,
        titleId,
        fact.amount_mkr,
        fact.source_year,
        fact.source_month,
        fact.source_status,
      ],
    );
    inserted++;
  }

  console.log(`[skatteintakter] monthly facts seeded: ${inserted}/${facts.length}`);
}

async function main() {
  console.log('[skatteintakter] starting seeder');
  const masterList = await getMasterList();
  const facts = await loadFacts(REPO_ROOT);
  const outcomeSnapshot = await fetchIncomeOutcomeSnapshot();
  console.log(`[skatteintakter] master list: ${masterList.length}, facts loaded: ${facts.length}`);
  console.log(
    `[skatteintakter] monthly outcome snapshot: ${outcomeSnapshot.titles.length} titles, ` +
    `${outcomeSnapshot.facts.length} facts from ${outcomeSnapshot.source_year}-${String(outcomeSnapshot.source_month).padStart(2, '0')} (${outcomeSnapshot.source_status})`,
  );

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
    console.log(
      `  monthly snapshot ${outcomeSnapshot.source_year}-${String(outcomeSnapshot.source_month).padStart(2, '0')} ` +
      `(${outcomeSnapshot.source_status}) from ${outcomeSnapshot.source_url}`,
    );
    for (const title of outcomeSnapshot.titles.slice(0, 20)) {
      console.log(
        `  monthly-dim ${title.code.padEnd(10)} ${title.level_key.padEnd(20)} ` +
        `${(title.parent_code ?? '(root)').padEnd(10)} ${title.name_sv}`,
      );
    }
    if (outcomeSnapshot.titles.length > 20) {
      console.log(`  ... +${outcomeSnapshot.titles.length - 20} more monthly dim rows`);
    }
    for (const fact of outcomeSnapshot.facts.slice(0, 20)) {
      console.log(
        `  monthly-fact ${fact.year}-${String(fact.month).padStart(2, '0')} ` +
        `${fact.code.padEnd(10)} ${fact.amount_mkr} Mkr`,
      );
    }
    if (outcomeSnapshot.facts.length > 20) {
      console.log(`  ... +${outcomeSnapshot.facts.length - 20} more monthly facts`);
    }
    return;
  }

  try {
    await applyMigration(client);
    // Truncate facts first so dim deletions don't violate FK constraints
    await client.query('truncate public.fact_income restart identity');
    await client.query('truncate public.fact_income_outcome_month restart identity');
    await ensureDimYears(client, [
      ...facts.map((fact) => fact.year),
      ...outcomeSnapshot.facts.map((fact) => fact.year),
    ]);
    await seedDim(client, masterList);
    await seedFacts(client, facts);
    await seedOutcomeDim(client, outcomeSnapshot.titles);
    await seedOutcomeFacts(client, outcomeSnapshot.facts);
    console.log('[skatteintakter] done');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('[skatteintakter] FAILED:', err);
  process.exit(1);
});
