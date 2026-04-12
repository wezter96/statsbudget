# Skatteintakter (Tax Revenues) — Design Spec

## Overview

New route showing where the Swedish government's revenue comes from, how it breaks down by tax type, and how it has changed over time. Mirrors the existing skatteutgifter (tax expenditures) pattern but focused on the income side of the budget.

Motivated by user feedback: "Finns det mojlighet/data att gora nagot liknande fast skatteinktakter? Typ var de olika intakterna kommer ifran."

## Data Model

Star schema, same pattern as skatteutgifter.

### dim_income_title

| Column | Type | Notes |
|--------|------|-------|
| income_title_id | int, PK | |
| parent_id | int, nullable, FK -> self | null = top-level group, otherwise subtitle |
| code | text, unique | ESV inkomsttitel code, e.g. "1100", "1111" |
| name_sv | text | |
| name_en | text, nullable | |
| description_sv | text, nullable | |
| sort_order | int | |

### fact_income

| Column | Type | Notes |
|--------|------|-------|
| fact_id | bigserial, PK | |
| year_id | int, FK -> dim_year | |
| income_title_id | int, FK -> dim_income_title | |
| amount_mkr | numeric(14,2) | |
| is_estimated | boolean | true for forecast years |

**RLS:** Public read-only (same as all other tables).

**Indexes:** `(year_id, income_title_id)` on fact_income.

### Hierarchy

Top-level groups (~6-8):
- Skatt pa arbete (1100)
- Skatt pa kapital (1200)
- Mervardesskatt / moms (1400)
- Punktskatter (1500)
- Socialavgifter och loneskatter (1300)
- Ovriga skatter (1600)
- Icke-skatteinkomster (2000+)

Subtitles (~30-50 items) nest under these via `parent_id`.

## Data Pipeline

### Files

```
data/skatteintakter.csv                        <- year, code, amount_mkr, is_estimated
scripts/skatteintakter/master-list.json        <- definitions with hierarchy
scripts/skatteintakter/seed-skatteintakter.ts   <- idempotent Supabase seeder
supabase/migrations/YYYYMMDD_skatteintakter.sql <- schema migration
```

### CSV format

```csv
year,code,amount_mkr,is_estimated
2003,1100,432000,false
2003,1111,285000,false
...
2026,1100,612000,true
```

### Master list structure

```json
[
  {
    "code": "1100",
    "parent_code": null,
    "name_sv": "Skatt pa arbete",
    "name_en": "Tax on labour",
    "description_sv": "...",
    "sort_order": 1
  },
  {
    "code": "1111",
    "parent_code": "1100",
    "name_sv": "Kommunal inkomstskatt",
    "name_en": "Municipal income tax",
    "description_sv": "...",
    "sort_order": 2
  }
]
```

### Data source

ESV (Ekonomistyrningsverket) Excel files with utfall (actuals) and prognoser (forecasts). Manual download and conversion to CSV for v1. Target coverage: ~20+ years matching existing statsbudget year range.

### Seeder

Same pattern as `scripts/skatteutgifter/seed-skatteutgifter.ts`:
- Reads master-list.json for dimension data
- Reads CSV for fact data
- Resolves parent_code -> parent_id
- Idempotent upsert (truncate + insert)
- Dry-run mode when DATABASE_URL not set

## Page Layout

Route: `/skatteintakter` (sv), `/en/tax-revenues` (en)

### Section 1: Hero / Intro

Standard hero with heading + explanatory text. Same pattern as Skatteutgifter page.

### Section 2: Overview (Pie Chart + Key Figures)

- ECharts pie chart showing top-level groups' share of total revenue for selected year
- Year selector dropdown (shared state with table)
- Clickable pie sectors — click scrolls to that category in the table below
- Key figures: total revenue in mdr kr, year-over-year change %
- New component: `src/components/income/IncomePieChart.tsx`

### Section 3: Trend Line Chart

- ECharts line chart with one line per top-level group
- X-axis: years (full time span), Y-axis: mdr kr
- Tooltip on hover with amounts per category
- Toggleable legend to show/hide categories
- New component: `src/components/income/IncomeTrendChart.tsx`

### Section 4: Detailed Table with Drill-Down

- Top-level groups as expandable rows (click to reveal subtitles)
- Columns: Name, Amount (Mkr), Share (%), Change vs previous year
- Free-text search
- Year selector (shared with pie chart)
- Default sort: descending by amount
- New component: `src/components/income/IncomeTable.tsx`

### Page component

`src/pages/Skatteintakter.tsx` — orchestrates sections, manages shared year state.

## Queries

New functions in `src/lib/budget-queries.ts`:

```typescript
getIncomeGroups(): Promise<DimIncomeTitle[]>
  // dim_income_title where parent_id is null, ordered by sort_order

getIncomeSubtitles(parentId: number): Promise<DimIncomeTitle[]>
  // dim_income_title where parent_id = parentId, ordered by sort_order

getIncomeFacts(year: number): Promise<FactIncome[]>
  // fact_income where year_id = year

getIncomeTimeSeries(): Promise<FactIncome[]>
  // all fact_income rows, ordered by year_id
```

New types in `src/lib/supabase-types.ts`:

```typescript
interface DimIncomeTitle {
  income_title_id: number;
  parent_id: number | null;
  code: string;
  name_sv: string;
  name_en: string | null;
  description_sv: string | null;
  sort_order: number;
}

interface FactIncome {
  fact_id: number;
  year_id: number;
  income_title_id: number;
  amount_mkr: number;
  is_estimated: boolean;
}
```

## i18n

New keys in `src/locales/sv.json` and `src/locales/en.json`:

```json
"skatteintakter": {
  "title": "Skatteintakter",
  "intro": "...",
  "pieHeading": "...",
  "trendHeading": "...",
  "tableHeading": "...",
  "col": {
    "name": "Namn",
    "amount": "Belopp (Mkr)",
    "share": "Andel",
    "change": "Forandring"
  },
  "year": "Ar",
  "total": "Totala intakter",
  "search": "Sok",
  "searchPlaceholder": "Sok inkomsttitel...",
  "noData": "...",
  "noMatch": "...",
  "estimated": "prognos",
  "sourcesLabel": "Kallor",
  "caveat": "..."
}
```

## Routing & Navigation

### App.tsx

```
/skatteintakter          -> <Skatteintakter />
/en/tax-revenues         -> <Skatteintakter />
```

### site-config.ts

```typescript
{ path: '/skatteintakter', changefreq: 'monthly', priority: '0.7' },
{ path: '/en/tax-revenues', changefreq: 'monthly', priority: '0.6' },
```

### Navigation

Add link in Layout nav component, next to skatteutgifter link.

## Out of Scope (v1)

- Connection to `fact_budget.is_revenue` data (future enhancement)
- Automated ESV Excel/PDF parser
- International comparisons (tax ratio vs OECD)
- Inflation adjustment / GDP share (DisplayMode support)
- AI chat integration for tax revenue queries
