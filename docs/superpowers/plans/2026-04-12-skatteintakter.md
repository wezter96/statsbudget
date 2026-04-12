# Skatteintakter (Tax Revenues) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/skatteintakter` route showing Swedish government tax revenue by category with pie chart, trend line chart, and drill-down table.

**Architecture:** Star-schema data model (`dim_income_title` + `fact_income`) with hierarchical categories (parent_id self-reference). Data pipeline from CSV + JSON master list via Bun seeder to Supabase. React page with ECharts pie/line charts and expandable table, following existing patterns from the budget explorer and skatteutgifter pages.

**Tech Stack:** React 18, React Router v6, TanStack React Query, ECharts (via echarts-for-react), Supabase (PostgreSQL + RLS), i18next, Tailwind CSS, Bun (scripts)

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260412160000_skatteintakter.sql` | Schema: dim_income_title + fact_income tables, indexes, RLS |
| `scripts/skatteintakter/types.ts` | TypeScript types for seeder (IncomeTitleDef, IncomeFact) |
| `scripts/skatteintakter/master-list.json` | Income title definitions with hierarchy |
| `data/skatteintakter.csv` | Fact data: year, code, amount_mkr, is_estimated |
| `scripts/skatteintakter/fetch-skatteintakter.ts` | Loader for master list + CSV facts |
| `scripts/skatteintakter/seed-skatteintakter.ts` | Idempotent Supabase seeder |
| `src/components/income/IncomePieChart.tsx` | ECharts donut chart for revenue breakdown |
| `src/components/income/IncomeTrendChart.tsx` | ECharts stacked area line chart for trends |
| `src/components/income/IncomeTable.tsx` | Expandable table with drill-down |
| `src/pages/Skatteintakter.tsx` | Page component orchestrating all sections |

### Modified files

| File | Change |
|------|--------|
| `src/lib/supabase-types.ts` | Add DimIncomeTitle + FactIncome interfaces |
| `src/lib/budget-queries.ts` | Add getIncomeGroups, getIncomeSubtitles, getIncomeFacts, getIncomeTimeSeries |
| `src/locales/sv.json` | Add `nav.skatteintakter` + `skatteintakter.*` keys |
| `src/locales/en.json` | Add `nav.taxRevenues` + `skatteintakter.*` keys |
| `src/App.tsx` | Add routes for `/skatteintakter` and `/en/tax-revenues` |
| `src/components/Header.tsx` | Add nav link for skatteintakter |
| `src/lib/site-config.ts` | Add sitemap entries |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260412160000_skatteintakter.sql`

- [ ] **Step 1: Write the migration SQL**

Create file `supabase/migrations/20260412160000_skatteintakter.sql`:

```sql
-- Skatteintakter (tax revenues) data layer.
-- Hierarchical income titles: top-level groups (parent_id IS NULL)
-- and subtitles (parent_id references a group).

create table if not exists public.dim_income_title (
  income_title_id  serial primary key,
  parent_id        int references public.dim_income_title(income_title_id),
  code             text not null unique,
  name_sv          text not null,
  name_en          text,
  description_sv   text,
  sort_order       int not null default 0
);

create table if not exists public.fact_income (
  fact_id          bigserial primary key,
  year_id          int not null references public.dim_year(year_id),
  income_title_id  int not null references public.dim_income_title(income_title_id),
  amount_mkr       numeric(14, 2) not null,
  is_estimated     boolean not null default false
);

create index if not exists idx_fact_income_year
  on public.fact_income(year_id, income_title_id);

alter table public.dim_income_title enable row level security;
alter table public.fact_income enable row level security;

drop policy if exists "public read dim_income_title" on public.dim_income_title;
create policy "public read dim_income_title"
  on public.dim_income_title for select using (true);

drop policy if exists "public read fact_income" on public.fact_income;
create policy "public read fact_income"
  on public.fact_income for select using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260412160000_skatteintakter.sql
git commit -m "feat(db): add dim_income_title and fact_income tables for tax revenues"
```

---

### Task 2: TypeScript Types (Seeder)

**Files:**
- Create: `scripts/skatteintakter/types.ts`

- [ ] **Step 1: Write seeder types**

Create file `scripts/skatteintakter/types.ts`:

```typescript
// Shared types for the skatteintakter seeder.

export interface IncomeTitleDef {
  code: string;
  parent_code: string | null;
  name_sv: string;
  name_en: string;
  description_sv: string;
  sort_order: number;
}

export interface IncomeFact {
  year: number;
  /** Matches IncomeTitleDef.code */
  code: string;
  amount_mkr: number;
  is_estimated: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/skatteintakter/types.ts
git commit -m "feat(scripts): add skatteintakter seeder types"
```

---

### Task 3: Master List + CSV Data

**Files:**
- Create: `scripts/skatteintakter/master-list.json`
- Create: `data/skatteintakter.csv`

This task requires researching and compiling actual Swedish tax revenue data from ESV. The data should cover the same year range as existing statsbudget data.

- [ ] **Step 1: Research ESV data**

Visit ESV's data portal (esv.se/data) and the budget proposition to collect:
- Top-level income categories with their official codes (1100-series, 2000-series)
- Subtitles under each category
- Yearly amounts in Mkr

Key categories to include (based on statsbudgetens inkomster):

| Code | Name (sv) | Name (en) |
|------|-----------|-----------|
| 1100 | Direkta skatter på arbete | Direct taxes on labour |
| 1200 | Indirekta skatter på arbete | Indirect taxes on labour |
| 1300 | Skatt på kapital | Tax on capital |
| 1400 | Skatt på konsumtion och insatsvaror | Tax on consumption and inputs |
| 1500 | Skatt på import | Tax on imports |
| 1600 | Restförda och övriga skatter | Residual and other taxes |
| 2000 | Inkomster av statens verksamhet | Income from state activities |
| 3000 | Inkomster av försåld egendom | Income from sold property |
| 4000 | Återbetalning av lån | Repayment of loans |
| 5000 | Kalkylmässiga inkomster | Imputed income |
| 6000 | Bidrag m.m. från EU | EU contributions |
| 7000 | Avskrivningar, amorteringar | Depreciation, amortization |
| 9000 | Lönemedel m.m. | Payroll funds |

Subtitles examples under 1100:
- 1111: Statlig inkomstskatt
- 1115: Kommunal inkomstskatt (utjämningsbidrag-relaterat)
- 1120: Allmän pensionsavgift

- [ ] **Step 2: Create master-list.json**

Create file `scripts/skatteintakter/master-list.json` with the collected definitions. Structure:

```json
[
  {
    "code": "1100",
    "parent_code": null,
    "name_sv": "Direkta skatter på arbete",
    "name_en": "Direct taxes on labour",
    "description_sv": "Inkomstskatter som betalas direkt av löntagare och egenföretagare, inklusive statlig och kommunal inkomstskatt samt allmän pensionsavgift.",
    "sort_order": 1
  },
  {
    "code": "1111",
    "parent_code": "1100",
    "name_sv": "Statlig inkomstskatt",
    "name_en": "State income tax",
    "description_sv": "Skatt på förvärvsinkomster som överstiger skiktgränsen. Har uppgått till 20% sedan 2020.",
    "sort_order": 2
  }
]
```

Populate with all categories and subtitles found during research. Aim for 6-13 top-level groups and 30-50 subtitles total.

- [ ] **Step 3: Create skatteintakter.csv**

Create file `data/skatteintakter.csv` with fact data. Format:

```csv
year,code,amount_mkr,is_estimated
2003,1100,432000,false
2003,1111,48000,false
2003,1200,395000,false
```

Include data for as many years as available from ESV (target: 2000-2026). Mark forecast years with `is_estimated=true`.

Include both top-level aggregate amounts AND subtitle-level amounts where available. Top-level amounts should be the actual totals from ESV, not computed sums of subtitles (this avoids rounding discrepancies).

- [ ] **Step 4: Commit**

```bash
git add scripts/skatteintakter/master-list.json data/skatteintakter.csv
git commit -m "feat(data): add skatteintakter master list and CSV fact data"
```

---

### Task 4: Data Loader (fetch-skatteintakter.ts)

**Files:**
- Create: `scripts/skatteintakter/fetch-skatteintakter.ts`

- [ ] **Step 1: Write the loader**

Create file `scripts/skatteintakter/fetch-skatteintakter.ts`:

```typescript
// Loader for skatteintakter master list and fact rows.
//
// Sources:
//   scripts/skatteintakter/master-list.json — curated income title definitions
//   data/skatteintakter.csv                 — yearly amounts from ESV

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomeTitleDef, IncomeFact } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function getMasterList(): Promise<IncomeTitleDef[]> {
  const jsonPath = resolve(__dirname, 'master-list.json');
  if (!existsSync(jsonPath)) {
    throw new Error(
      'master-list.json missing at ' + jsonPath,
    );
  }
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as IncomeTitleDef[];
}

/**
 * Load fact rows from the CSV. Returns [] if no CSV found.
 */
export async function loadFacts(repoRoot: string): Promise<IncomeFact[]> {
  const csvPath = resolve(repoRoot, 'data', 'skatteintakter.csv');
  if (!existsSync(csvPath)) {
    console.warn(`[skatteintakter] No CSV at ${csvPath}`);
    return [];
  }
  const text = await readFile(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map(h => h.trim());
  const idx = {
    year: header.indexOf('year'),
    code: header.indexOf('code'),
    amount: header.indexOf('amount_mkr'),
    est: header.indexOf('is_estimated'),
  };
  if (idx.year < 0 || idx.code < 0 || idx.amount < 0) {
    throw new Error(
      `skatteintakter.csv: missing required columns. Got: ${header.join(',')}`,
    );
  }

  const facts: IncomeFact[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(c => c.trim());
    facts.push({
      year: parseInt(cols[idx.year], 10),
      code: cols[idx.code],
      amount_mkr: parseFloat(cols[idx.amount]),
      is_estimated: idx.est >= 0 ? cols[idx.est].toLowerCase() === 'true' : false,
    });
  }
  return facts;
}
```

- [ ] **Step 2: Verify it loads**

```bash
cd /Users/anton/Documents/repos/statsbudget
bun -e "import { getMasterList, loadFacts } from './scripts/skatteintakter/fetch-skatteintakter.ts'; const m = await getMasterList(); const f = await loadFacts('.'); console.log('master:', m.length, 'facts:', f.length);"
```

Expected: prints count of items without errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/skatteintakter/fetch-skatteintakter.ts
git commit -m "feat(scripts): add skatteintakter data loader"
```

---

### Task 5: Database Seeder

**Files:**
- Create: `scripts/skatteintakter/seed-skatteintakter.ts`

- [ ] **Step 1: Write the seeder**

Create file `scripts/skatteintakter/seed-skatteintakter.ts`:

```typescript
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
      console.log(`  dim  ${d.code.padEnd(10)}  ${d.parent_code ?? '(root)'.padEnd(10)}  ${d.name_sv}`);
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
```

- [ ] **Step 2: Run in DRY mode to verify**

```bash
cd /Users/anton/Documents/repos/statsbudget
bun scripts/skatteintakter/seed-skatteintakter.ts
```

Expected: prints "DRY mode" and lists master list + fact rows without errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/skatteintakter/seed-skatteintakter.ts
git commit -m "feat(scripts): add skatteintakter database seeder"
```

---

### Task 6: Frontend Types + Queries

**Files:**
- Modify: `src/lib/supabase-types.ts`
- Modify: `src/lib/budget-queries.ts`

- [ ] **Step 1: Add types to supabase-types.ts**

Add at the end of `src/lib/supabase-types.ts` (after the `FactBudget` interface, before `DisplayMode`):

```typescript
export interface DimIncomeTitle {
  income_title_id: number;
  parent_id: number | null;
  code: string;
  name_sv: string;
  name_en: string | null;
  description_sv: string | null;
  sort_order: number;
}

export interface FactIncome {
  fact_id: number;
  year_id: number;
  income_title_id: number;
  amount_mkr: number;
  is_estimated: boolean;
}
```

- [ ] **Step 2: Add query functions to budget-queries.ts**

Add the import of the new types to the existing import line at the top of `src/lib/budget-queries.ts`:

```typescript
import type {
  DimYear, DimArea, DimAnslag, DimParty, FactBudget, FactHistorical, DisplayMode,
  DimSkatteutgift, FactSkatteutgift,
  DimIncomeTitle, FactIncome,
} from './supabase-types';
```

Add at the end of `src/lib/budget-queries.ts` (after the skatteutgifter section):

```typescript
// ---------- Skatteintakter (tax revenues) ----------

export async function getIncomeGroups(): Promise<DimIncomeTitle[]> {
  const { data, error } = await db
    .from('dim_income_title')
    .select('*')
    .is('parent_id', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimIncomeTitle[];
}

export async function getIncomeSubtitles(parentId: number): Promise<DimIncomeTitle[]> {
  const { data, error } = await db
    .from('dim_income_title')
    .select('*')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimIncomeTitle[];
}

export async function getIncomeFacts(year: number): Promise<FactIncome[]> {
  const { data, error } = await db
    .from('fact_income')
    .select('*')
    .eq('year_id', year);
  if (error) throw error;
  return (data ?? []) as FactIncome[];
}

export async function getIncomeTimeSeries(): Promise<FactIncome[]> {
  const { data, error } = await db
    .from('fact_income')
    .select('*')
    .order('year_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FactIncome[];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/anton/Documents/repos/statsbudget
npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: no new errors related to income types/queries.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase-types.ts src/lib/budget-queries.ts
git commit -m "feat: add skatteintakter types and Supabase query functions"
```

---

### Task 7: i18n Translation Keys

**Files:**
- Modify: `src/locales/sv.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: Add Swedish nav key**

In `src/locales/sv.json`, add to the `"nav"` object (after `"skatteutgifter": "Skatteutgifter"`):

```json
"skatteintakter": "Skatteintäkter"
```

- [ ] **Step 2: Add Swedish skatteintakter section**

In `src/locales/sv.json`, add a new top-level `"skatteintakter"` object (after the `"skatteutgifter"` section):

```json
"skatteintakter": {
  "title": "Skatteintäkter",
  "intro": "Varifrån kommer statens pengar? Här visas hur de totala skatteintäkterna fördelar sig mellan olika skatte- och inkomsttyper, och hur de har utvecklats över tid.",
  "disclosure": "Uppgifterna kommer från Ekonomistyrningsverket (ESV) och avser statsbudgetens inkomstsida. Vissa år är prognoser.",
  "pieHeading": "Fördelning av skatteintäkter",
  "trendHeading": "Utveckling över tid",
  "tableHeading": "Alla inkomsttitlar",
  "col": {
    "name": "Inkomsttitel",
    "amount": "Belopp (Mkr)",
    "share": "Andel",
    "change": "Förändring"
  },
  "year": "År",
  "total": "Totala intäkter",
  "totalChange": "mot föregående år",
  "search": "Sök",
  "searchPlaceholder": "Sök inkomsttitel...",
  "noData": "Ingen data tillgänglig för valt år.",
  "noMatch": "Inga inkomsttitlar matchar din sökning.",
  "estimated": "prognos",
  "unit": "Mkr",
  "sourcesLabel": "Källor",
  "caveat": "Beloppen avser statsbudgetens inkomstsida. Kommunalskatt redovisas delvis separat. Vissa år är prognoser, inte utfall."
}
```

- [ ] **Step 3: Add English nav key**

In `src/locales/en.json`, add to the `"nav"` object (after `"skatteutgifter": "Tax expenditures"`):

```json
"skatteintakter": "Tax revenues"
```

- [ ] **Step 4: Add English skatteintakter section**

In `src/locales/en.json`, add a new top-level `"skatteintakter"` object (after the `"skatteutgifter"` section):

```json
"skatteintakter": {
  "title": "Tax revenues",
  "intro": "Where does the government's money come from? This page shows how total tax revenues are distributed across different tax types and income categories, and how they have changed over time.",
  "disclosure": "Data sourced from ESV (Swedish National Financial Management Authority) covering the state budget's revenue side. Some years are forecasts.",
  "pieHeading": "Revenue breakdown",
  "trendHeading": "Trends over time",
  "tableHeading": "All income titles",
  "col": {
    "name": "Income title",
    "amount": "Amount (Mkr)",
    "share": "Share",
    "change": "Change"
  },
  "year": "Year",
  "total": "Total revenue",
  "totalChange": "vs previous year",
  "search": "Search",
  "searchPlaceholder": "Search income title...",
  "noData": "No data available for the selected year.",
  "noMatch": "No income titles match your search.",
  "estimated": "forecast",
  "unit": "Mkr",
  "sourcesLabel": "Sources",
  "caveat": "Amounts refer to the state budget's revenue side. Municipal taxes are partly reported separately. Some years are forecasts, not actuals."
}
```

- [ ] **Step 5: Commit**

```bash
git add src/locales/sv.json src/locales/en.json
git commit -m "feat(i18n): add skatteintakter translation keys (sv + en)"
```

---

### Task 8: IncomePieChart Component

**Files:**
- Create: `src/components/income/IncomePieChart.tsx`

- [ ] **Step 1: Create the component**

Create file `src/components/income/IncomePieChart.tsx`:

```tsx
import { useMemo, useRef, useState, useCallback } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { stableColor, CHROME, ECHARTS_COLOR_ARRAY } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { DimIncomeTitle } from '@/lib/supabase-types';

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

export interface IncomePieRow {
  group: DimIncomeTitle;
  amount_mkr: number;
  pct: number;
}

interface Props {
  rows: IncomePieRow[];
  year: number;
  onGroupClick?: (groupId: number) => void;
}

const IncomePieChart = ({ rows, year, onGroupClick }: Props) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chartRef = useRef<any>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    if (Math.abs(v) >= 1000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr kr`;
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} ${t('skatteintakter.unit')}`;
  };

  const pieData = useMemo(
    () => rows.map((r) => ({
      name: isEn && r.group.name_en ? r.group.name_en : r.group.name_sv,
      value: r.amount_mkr,
      groupId: r.group.income_title_id,
      itemStyle: { color: stableColor(r.group.name_sv) },
    })),
    [rows, isEn],
  );

  const total = rows.reduce((s, r) => s + r.amount_mkr, 0);

  const option: echarts.EChartsCoreOption = useMemo(
    () => ({
      color: ECHARTS_COLOR_ARRAY,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: CHROME.surface,
        borderColor: CHROME.border,
        extraCssText: 'max-width:260px; white-space:normal; word-break:break-word; box-shadow:0 4px 16px rgba(0,0,0,0.08);',
        textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
        formatter: (p: any) =>
          `<div style="max-width:240px;line-height:1.4"><strong style="font-family:Fraunces,serif;display:block;margin-bottom:4px">${p.name}</strong>${fmtMkr(p.value)} · ${p.percent}%</div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '74%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          minAngle: 3,
          padAngle: 0.5,
          itemStyle: {
            borderRadius: 2,
            borderColor: CHROME.bg,
            borderWidth: 1,
          },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 8,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0,0,0,0.18)',
            },
          },
          data: pieData,
          animationDuration: prefersReducedMotion ? 0 : 600,
          animationEasing: 'cubicOut',
        },
      ],
    }),
    [pieData, prefersReducedMotion],
  );

  const highlightSlice = useCallback((idx: number | null) => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    if (idx == null) {
      chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
      return;
    }
    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
  }, []);

  const onChartEvents = useMemo(
    () => ({
      mouseover: (e: any) => {
        if (typeof e?.dataIndex === 'number') setHoverIdx(e.dataIndex);
      },
      mouseout: () => setHoverIdx(null),
      click: (e: any) => {
        const id = e?.data?.groupId;
        if (id && onGroupClick) onGroupClick(id);
      },
    }),
    [onGroupClick],
  );

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 min-w-0">
        <div className="flex items-center justify-center rounded-xl bg-card p-2 sm:p-4 ring-1 ring-border/60 h-[260px] sm:h-[300px] lg:h-[420px] overflow-hidden">
          <ReactEChartsCore
            ref={chartRef}
            echarts={echarts}
            option={option}
            style={{ height: '100%', width: '100%' }}
            onEvents={onChartEvents}
            // @ts-expect-error echarts-for-react spreads extra props to the wrapper div
            role="img"
            aria-label={`${t('skatteintakter.pieHeading')} ${year}`}
          />
        </div>
      </div>

      <div className="lg:col-span-3 min-w-0">
        <div className="rounded-xl bg-card ring-1 ring-border/60 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-7 sm:w-10" />
              <col />
              <col className="w-[8rem] sm:w-40" />
              <col className="w-0 sm:w-16" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 sm:px-3 py-2 font-medium">#</th>
                <th className="px-2 sm:px-3 py-2 font-medium">{t('skatteintakter.col.name')}</th>
                <th className="px-2 sm:px-3 py-2 font-medium text-right">{t('skatteintakter.col.amount')}</th>
                <th className="px-2 sm:px-3 py-2 font-medium text-right hidden sm:table-cell">{t('skatteintakter.col.share')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const name = isEn && r.group.name_en ? r.group.name_en : r.group.name_sv;
                const color = stableColor(r.group.name_sv);
                const isHover = hoverIdx === i;
                return (
                  <tr
                    key={r.group.income_title_id}
                    onMouseEnter={() => { setHoverIdx(i); highlightSlice(i); }}
                    onMouseLeave={() => { setHoverIdx(null); highlightSlice(null); }}
                    onClick={() => onGroupClick?.(r.group.income_title_id)}
                    className={cn(
                      'cursor-pointer border-t border-border/50 transition-colors',
                      isHover && 'bg-primary/5',
                    )}
                  >
                    <td className="px-2 sm:px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2 sm:px-3 py-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-foreground truncate text-xs sm:text-sm" title={name}>
                          {name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right tabular-nums whitespace-nowrap text-xs sm:text-sm">
                      {fmtMkr(r.amount_mkr)}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {r.pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-right text-sm text-muted-foreground">
          {t('skatteintakter.total')}: <strong className="text-foreground">{fmtMkr(total)}</strong>
        </div>
      </div>
    </div>
  );
};

export default IncomePieChart;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/income/IncomePieChart.tsx
git commit -m "feat: add IncomePieChart component for tax revenue breakdown"
```

---

### Task 9: IncomeTrendChart Component

**Files:**
- Create: `src/components/income/IncomeTrendChart.tsx`

- [ ] **Step 1: Create the component**

Create file `src/components/income/IncomeTrendChart.tsx`:

```tsx
import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { ECHARTS_COLOR_ARRAY, CHROME, stableColor } from '@/lib/palette';
import SourceLink from '@/components/SourceLink';

echarts.use([LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface TrendSeries {
  name: string;
  colorKey: string;
  data: { year: number; value: number }[];
}

interface Props {
  series: TrendSeries[];
  yearFrom: number;
  yearTo: number;
}

const IncomeTrendChart = ({ series, yearFrom, yearTo }: Props) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    if (Math.abs(v) >= 1000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr`;
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} Mkr`;
  };

  const years = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearFrom + i);

  const echartsSeriesData = useMemo(
    () => series.map((s) => {
      const color = stableColor(s.colorKey);
      return {
        name: s.name,
        type: 'line' as const,
        stack: 'total',
        data: years.map(y => {
          const point = s.data.find(d => d.year === y);
          return point ? point.value : 0;
        }),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1, color },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.55 },
      };
    }),
    [series, years],
  );

  const option: echarts.EChartsCoreOption = useMemo(
    () => ({
      color: ECHARTS_COLOR_ARRAY,
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: CHROME.surface,
        borderColor: CHROME.border,
        extraCssText: 'max-width:340px; white-space:normal; word-break:break-word; box-shadow:0 4px 16px rgba(0,0,0,0.08);',
        textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const total = params.reduce((s: number, p: any) => s + (Number(p.value) || 0), 0);
          const sorted = [...params]
            .filter((p: any) => Number(p.value) > 0)
            .sort((a: any, b: any) => Number(b.value) - Number(a.value));
          const header = `<div style="margin-bottom:6px"><strong style="font-family:Fraunces,serif">${params[0]?.axisValue}</strong> · ${isEn ? 'Total' : 'Totalt'} ${fmtMkr(total)}</div>`;
          const rowHtml = sorted
            .map((p: any) => {
              const name = p.seriesName && p.seriesName.length > 32 ? p.seriesName.slice(0, 31) + '\u2026' : p.seriesName;
              return `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.5"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="color:${p.color}">\u25CF</span> ${name}</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums;color:${CHROME.textMuted}">${fmtMkr(p.value)}</span></div>`;
            })
            .join('');
          return `<div style="max-width:320px">${header}${rowHtml}</div>`;
        },
      },
      grid: {
        left: window.innerWidth < 640 ? 50 : 70,
        right: window.innerWidth < 640 ? 8 : 20,
        top: 20,
        bottom: 36,
      },
      xAxis: {
        type: 'category',
        data: years.map(String),
        axisLabel: {
          fontFamily: 'Inter',
          fontSize: window.innerWidth < 640 ? 10 : 11,
          color: CHROME.textMuted,
          interval: window.innerWidth < 640 ? Math.max(1, Math.floor(years.length / 6)) : undefined,
        },
        axisLine: { lineStyle: { color: CHROME.border } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontFamily: 'Inter',
          fontSize: 11,
          color: CHROME.textMuted,
          formatter: (v: number) => fmtMkr(v),
        },
        splitLine: { lineStyle: { color: CHROME.border } },
      },
      series: echartsSeriesData,
      animationDuration: prefersReducedMotion ? 0 : 800,
    }),
    [echartsSeriesData, years, prefersReducedMotion, isEn],
  );

  // Build legend items manually (same pattern as TimeSeriesChart)
  const legendItems = useMemo(
    () => series.map(s => ({
      name: s.name,
      color: stableColor(s.colorKey),
    })),
    [series],
  );

  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge={true}
        lazyUpdate={false}
        style={{ height: window.innerWidth < 640 ? '280px' : '400px', width: '100%' }}
        // @ts-expect-error echarts-for-react spreads extra props to wrapper div
        role="img"
        aria-label={t('skatteintakter.trendHeading')}
      />
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {legendItems.map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span className="relative inline-block h-3 w-5 shrink-0" aria-hidden="true">
              <span
                className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2"
                style={{ backgroundColor: item.color }}
              />
              <span
                className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </span>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2"><SourceLink sources="ESV" /></div>
    </div>
  );
};

export default IncomeTrendChart;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/income/IncomeTrendChart.tsx
git commit -m "feat: add IncomeTrendChart component for revenue trends"
```

---

### Task 10: IncomeTable Component

**Files:**
- Create: `src/components/income/IncomeTable.tsx`

- [ ] **Step 1: Create the component**

Create file `src/components/income/IncomeTable.tsx`:

```tsx
import { Fragment, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { stableColor } from '@/lib/palette';
import { getIncomeSubtitles } from '@/lib/budget-queries';
import { cn } from '@/lib/utils';
import type { DimIncomeTitle, FactIncome } from '@/lib/supabase-types';

export interface IncomeGroupRow {
  group: DimIncomeTitle;
  amount_mkr: number;
  pct: number;
  changePct: number | null;
  is_estimated: boolean;
}

interface Props {
  rows: IncomeGroupRow[];
  year: number;
  facts: FactIncome[];
  search: string;
  expandedGroupId: number | null;
  onToggleGroup: (id: number) => void;
}

const IncomeTable = ({ rows, year, facts, search, expandedGroupId, onToggleGroup }: Props) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} ${t('skatteintakter.unit')}`;
  };

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => {
      const name = (isEn && r.group.name_en ? r.group.name_en : r.group.name_sv).toLowerCase();
      const desc = (r.group.description_sv ?? '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [rows, search, isEn]);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium w-8" aria-hidden="true" />
            <th className="px-4 py-2 font-medium">{t('skatteintakter.col.name')}</th>
            <th className="px-4 py-2 font-medium text-right">{t('skatteintakter.col.amount')}</th>
            <th className="px-4 py-2 font-medium text-right hidden sm:table-cell">{t('skatteintakter.col.share')}</th>
            <th className="px-4 py-2 font-medium text-right hidden sm:table-cell">{t('skatteintakter.col.change')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const name = isEn && r.group.name_en ? r.group.name_en : r.group.name_sv;
            const color = stableColor(r.group.name_sv);
            const isExpanded = expandedGroupId === r.group.income_title_id;
            return (
              <Fragment key={r.group.income_title_id}>
                <tr
                  className={cn(
                    'border-t border-border cursor-pointer hover:bg-muted/30 transition-colors',
                    isExpanded && 'bg-primary/10',
                  )}
                  onClick={() => onToggleGroup(r.group.income_title_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleGroup(r.group.income_title_id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <td className="px-4 py-3">
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
                        !isExpanded && '-rotate-90',
                      )}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-foreground">{name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {fmtMkr(r.amount_mkr)}
                    {r.is_estimated && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({t('skatteintakter.estimated')})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {r.pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                    {r.changePct != null ? (
                      <span className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium leading-none',
                        r.changePct > 0 ? 'bg-green-100 text-green-700' : r.changePct < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="p-0 border-0">
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-in-out',
                        isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="bg-muted/30 px-4 py-3">
                          <SubtitleBreakdown
                            parentId={r.group.income_title_id}
                            parentName={r.group.name_sv}
                            facts={facts}
                            year={year}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                {t('skatteintakter.noMatch')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

interface SubtitleBreakdownProps {
  parentId: number;
  parentName: string;
  facts: FactIncome[];
  year: number;
}

const SubtitleBreakdown = ({ parentId, parentName, facts, year }: SubtitleBreakdownProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} ${t('skatteintakter.unit')}`;
  };

  const { data: subtitles, isLoading } = useQuery({
    queryKey: ['income-subtitles', parentId],
    queryFn: () => getIncomeSubtitles(parentId),
  });

  const rows = useMemo(() => {
    if (!subtitles) return [];
    const factById = new Map<number, number>();
    for (const f of facts) factById.set(f.income_title_id, Number(f.amount_mkr));
    return subtitles
      .map(s => ({
        ...s,
        amount: factById.get(s.income_title_id) ?? 0,
      }))
      .filter(s => s.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
  }, [subtitles, facts]);

  const subTotal = rows.reduce((s, r) => s + r.amount, 0);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('skatteintakter.noData')}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('skatteintakter.noMatch')}</p>;
  }

  return (
    <ul className="divide-y divide-border/50">
      {rows.map((r) => {
        const name = isEn && r.name_en ? r.name_en : r.name_sv;
        const pct = subTotal > 0 ? (r.amount / subTotal) * 100 : 0;
        return (
          <li key={r.income_title_id} className="flex items-center justify-between gap-2 py-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: stableColor(r.name_sv) }}
              />
              <span className="truncate text-foreground">{name}</span>
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 shrink-0 tabular-nums whitespace-nowrap">
              <span className="text-foreground">{fmtMkr(r.amount)}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{pct.toFixed(1)}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default IncomeTable;
```

- [ ] **Step 2: Commit**

```bash
git add src/components/income/IncomeTable.tsx
git commit -m "feat: add IncomeTable component with drill-down subtitles"
```

---

### Task 11: Skatteintakter Page

**Files:**
- Create: `src/pages/Skatteintakter.tsx`

- [ ] **Step 1: Create the page component**

Create file `src/pages/Skatteintakter.tsx`:

```tsx
import { useState, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import IncomePieChart from '@/components/income/IncomePieChart';
import IncomeTrendChart from '@/components/income/IncomeTrendChart';
import IncomeTable from '@/components/income/IncomeTable';
import {
  getIncomeGroups,
  getIncomeFacts,
  getIncomeTimeSeries,
  getYears,
} from '@/lib/budget-queries';
import type { FactIncome } from '@/lib/supabase-types';

const SkatteintakterPage = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const [params, setParams] = useSearchParams();
  const tableRef = useRef<HTMLDivElement>(null);

  const years = useQuery({ queryKey: ['years'], queryFn: getYears });
  const groups = useQuery({ queryKey: ['income-groups'], queryFn: getIncomeGroups });
  const series = useQuery({ queryKey: ['income-series'], queryFn: getIncomeTimeSeries });

  // Derive available years from fact data
  const availableYears = useMemo(() => {
    if (!series.data) return [];
    const set = new Set<number>();
    for (const f of series.data) set.add(f.year_id);
    return Array.from(set).sort((a, b) => b - a);
  }, [series.data]);

  const defaultYear = availableYears[0] ?? years.data?.at(-1)?.year_id;
  const yearParam = params.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : defaultYear;

  const facts = useQuery({
    queryKey: ['income-facts', selectedYear],
    queryFn: () => (selectedYear ? getIncomeFacts(selectedYear) : Promise.resolve([])),
    enabled: selectedYear != null,
  });

  // Previous year facts for change calculation
  const prevYear = selectedYear ? selectedYear - 1 : undefined;
  const prevFacts = useQuery({
    queryKey: ['income-facts', prevYear],
    queryFn: () => (prevYear ? getIncomeFacts(prevYear) : Promise.resolve([])),
    enabled: prevYear != null && availableYears.includes(prevYear),
  });

  // Build group rows with amounts
  const groupRows = useMemo(() => {
    if (!groups.data || !facts.data) return [];
    const factByTitle = new Map<number, { amount: number; estimated: boolean }>();
    for (const f of facts.data) {
      factByTitle.set(f.income_title_id, { amount: Number(f.amount_mkr), estimated: f.is_estimated });
    }
    const prevByTitle = new Map<number, number>();
    for (const f of prevFacts.data ?? []) {
      prevByTitle.set(f.income_title_id, Number(f.amount_mkr));
    }

    const rows = groups.data
      .map(g => {
        const amount = factByTitle.get(g.income_title_id)?.amount ?? 0;
        const estimated = factByTitle.get(g.income_title_id)?.estimated ?? false;
        const prevAmount = prevByTitle.get(g.income_title_id);
        const changePct = prevAmount && prevAmount !== 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
        return { group: g, amount_mkr: amount, is_estimated: estimated, changePct };
      })
      .filter(r => r.amount_mkr !== 0)
      .sort((a, b) => b.amount_mkr - a.amount_mkr);

    const total = rows.reduce((s, r) => s + r.amount_mkr, 0);
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.amount_mkr / total) * 100 : 0 }));
  }, [groups.data, facts.data, prevFacts.data]);

  // Pie data
  const pieRows = groupRows.map(r => ({
    group: r.group,
    amount_mkr: r.amount_mkr,
    pct: r.pct,
  }));

  // Trend data: one series per top-level group
  const trendData = useMemo(() => {
    if (!groups.data || !series.data) return { series: [], yearFrom: 0, yearTo: 0 };
    const groupIds = new Set(groups.data.map(g => g.income_title_id));
    const byGroup = new Map<number, { year: number; value: number }[]>();
    for (const f of series.data) {
      if (!groupIds.has(f.income_title_id)) continue;
      const arr = byGroup.get(f.income_title_id) ?? [];
      arr.push({ year: f.year_id, value: Number(f.amount_mkr) });
      byGroup.set(f.income_title_id, arr);
    }
    const allYears = series.data.map(f => f.year_id);
    const yearFrom = Math.min(...allYears);
    const yearTo = Math.max(...allYears);
    const trendSeries = groups.data
      .filter(g => byGroup.has(g.income_title_id))
      .map(g => ({
        name: isEn && g.name_en ? g.name_en : g.name_sv,
        colorKey: g.name_sv,
        data: byGroup.get(g.income_title_id)!,
      }));
    return { series: trendSeries, yearFrom, yearTo };
  }, [groups.data, series.data, isEn]);

  const total = groupRows.reduce((s, r) => s + r.amount_mkr, 0);
  const hasData = total > 0;

  const fmtMdr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr kr`;
  };

  const [search, setSearch] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  const handleGroupClick = (id: number) => {
    setExpandedGroupId(prev => prev === id ? null : id);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Layout>
      <Helmet>
        <title>{t('skatteintakter.title')} — Statsbudget</title>
        <meta name="description" content={t('skatteintakter.intro')} />
        <meta property="og:title" content={`${t('skatteintakter.title')} — Statsbudget`} />
        <meta property="og:description" content={t('skatteintakter.intro')} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Hero */}
      <section className="border-b border-border bg-muted/40 py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('skatteintakter.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('skatteintakter.intro')}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('skatteintakter.disclosure')}
          </p>
        </div>
      </section>

      {/* Pie chart overview */}
      <section className="py-10 sm:py-14 border-t border-border">
        <div className="container max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                {t('skatteintakter.pieHeading')}
              </h2>
              {hasData && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('skatteintakter.total')}: <strong className="text-foreground">{fmtMdr(total)}</strong>
                  {' '}({selectedYear})
                </p>
              )}
            </div>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteintakter.year')}</span>
              <select
                className="rounded-md border border-input bg-background px-3 py-2"
                value={selectedYear ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  const next = new URLSearchParams(params);
                  if (v) next.set('year', v); else next.delete('year');
                  setParams(next, { replace: true });
                }}
              >
                {(availableYears.length > 0 ? availableYears : (years.data ?? []).map(y => y.year_id))
                  .map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
              </select>
            </label>
          </div>

          {!hasData && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              {t('skatteintakter.noData')}
            </div>
          )}

          {hasData && (
            <IncomePieChart
              rows={pieRows}
              year={selectedYear!}
              onGroupClick={handleGroupClick}
            />
          )}
        </div>
      </section>

      {/* Trend chart */}
      {trendData.series.length > 0 && (
        <section className="py-10 sm:py-14 border-t border-border">
          <div className="container max-w-5xl">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl mb-6">
              {t('skatteintakter.trendHeading')}
            </h2>
            <IncomeTrendChart
              series={trendData.series}
              yearFrom={trendData.yearFrom}
              yearTo={trendData.yearTo}
            />
          </div>
        </section>
      )}

      {/* Detailed table */}
      <section ref={tableRef} className="py-10 sm:py-14 border-t border-border">
        <div className="container max-w-5xl">
          <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl mb-6">
            {t('skatteintakter.tableHeading')}
          </h2>

          <div className="mb-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteintakter.search')}</span>
              <input
                type="text"
                placeholder={t('skatteintakter.searchPlaceholder')}
                className="rounded-md border border-input bg-background px-3 py-2 w-full sm:w-56"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
          </div>

          {hasData && (
            <IncomeTable
              rows={groupRows}
              year={selectedYear!}
              facts={facts.data ?? []}
              search={search}
              expandedGroupId={expandedGroupId}
              onToggleGroup={(id) => setExpandedGroupId(prev => prev === id ? null : id)}
            />
          )}

          <div className="mt-8 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong>{t('skatteintakter.sourcesLabel')}:</strong>{' '}
              <a
                className="text-primary underline underline-offset-2"
                href="https://www.esv.se/statens-ekonomi/statens-budget/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ESV — Statens budget
              </a>
              {' · '}
              <a
                className="text-primary underline underline-offset-2"
                href="https://www.statistikdatabasen.scb.se/"
                target="_blank"
                rel="noopener noreferrer"
              >
                SCB Statistikdatabasen
              </a>
            </p>
            <p>{t('skatteintakter.caveat')}</p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default SkatteintakterPage;
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Skatteintakter.tsx
git commit -m "feat: add Skatteintakter page with pie chart, trend line, and table"
```

---

### Task 12: Routing, Navigation & Sitemap

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/lib/site-config.ts`

- [ ] **Step 1: Add routes in App.tsx**

Add import at the top of `src/App.tsx` (after the Skatteutgifter import):

```typescript
import Skatteintakter from "./pages/Skatteintakter";
```

Add Swedish route (after the `/skatteutgifter` route):

```tsx
<Route path="/skatteintakter" element={withLang(<Skatteintakter />)} />
```

Add English route (after the `/en/tax-expenditures` route):

```tsx
<Route path="/en/tax-revenues" element={withLang(<Skatteintakter />)} />
```

- [ ] **Step 2: Add nav link in Header.tsx**

In `src/components/Header.tsx`, add to the `links` array (after the skatteutgifter entry):

```typescript
{ to: '/skatteintakter', label: t('nav.skatteintakter') },
```

- [ ] **Step 3: Add sitemap entries in site-config.ts**

In `src/lib/site-config.ts`, add to `STATIC_SITE_ROUTES` array (after the `/about` entries, before `] as const`):

```typescript
{ path: '/skatteutgifter', changefreq: 'monthly' as const, priority: '0.7' },
{ path: '/skatteintakter', changefreq: 'monthly' as const, priority: '0.7' },
{ path: '/en/tax-expenditures', changefreq: 'monthly' as const, priority: '0.6' },
{ path: '/en/tax-revenues', changefreq: 'monthly' as const, priority: '0.6' },
```

Note: Check if `/skatteutgifter` and `/en/tax-expenditures` are already in the array. If not, add all four. If they are, only add the two skatteintakter entries.

- [ ] **Step 4: Verify the app compiles and the route loads**

```bash
cd /Users/anton/Documents/repos/statsbudget
npm run dev &
sleep 3
curl -s http://localhost:5173/skatteintakter | head -20
```

Expected: HTML page with the skatteintakter content.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/Header.tsx src/lib/site-config.ts
git commit -m "feat: add skatteintakter route, navigation link, and sitemap entries"
```

---

### Task 13: Seed Database & Verify

- [ ] **Step 1: Run the seeder against the database**

```bash
cd /Users/anton/Documents/repos/statsbudget
DATABASE_URL=<your-supabase-connection-string> bun scripts/skatteintakter/seed-skatteintakter.ts
```

Expected: "migration applied", dim seeded count, facts seeded count, "done".

- [ ] **Step 2: Verify in browser**

Open `http://localhost:5173/skatteintakter` and verify:
- Hero section renders with title and intro text
- Pie chart shows with top-level categories
- Year selector works (changing year updates pie + table)
- Trend line chart shows with multiple category lines
- Table shows expandable rows
- Clicking a pie sector scrolls to and expands that group in the table
- Clicking a table row expands to show subtitles
- Search filters table rows
- English route works at `/en/tax-revenues`
- Nav link appears in header

- [ ] **Step 3: Commit any fixes**

If any adjustments are needed after browser testing, fix and commit.

```bash
git add -A
git commit -m "fix: adjust skatteintakter page after browser testing"
```
