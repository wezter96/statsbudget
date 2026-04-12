# Förslag 2: Year Comparison Feature

## Goal
Add a "Jämför" (Compare) button to the budget explorer that lets users compare the current year's budget distribution against any previous year, showing what changed and by how much.

## Current State
- Explorer shows one year at a time with pie chart + table (BudgetPieTable)
- Year-over-year change badges already exist (changePct in PieRow, green/red pills)
- Data fetching: `getBudgetByYear(year)` returns `FactBudget[]` with `area_id`, `amount_nominal_sek`, `budget_type`
- Display modes: `total_pct | real | nominal | gdp_pct` via `convertAmount()`
- Previous year data already fetched for change badges (`prevYear = selectedYear - 1`)
- Available years from `getBudgetYears()` → `regularYears[]`

## Design

### UI Approach: Extra column in existing table (not side-by-side)
Side-by-side layouts break on mobile. Instead:
1. Add a "Jämför" toggle button next to the year picker
2. When active, show a second year dropdown (defaults to selectedYear - 1)
3. The table gets an additional column showing the comparison year's amount
4. Change badge updates to show diff vs the comparison year (not just year-1)
5. Pie chart could show both years as concentric rings (outer = current, inner = comparison)

### Table Layout When Comparison Active

**Desktop (sm+):**
| # | Utgiftsområde | {year} | {compareYear} | Förändring | Andel |
|---|---|---|---|---|---|

**Mobile:**
| # | Utgiftsområde | {year} | Förändr. |
|---|---|---|---|

### Key Components to Modify

1. **Explorer.tsx** — Add comparison state + UI controls
   - `const [compareYear, setCompareYear] = useState<number | null>(null)`
   - `const [compareActive, setCompareActive] = useState(false)`
   - Fetch comparison year data: `getBudgetByYear(compareYear)` (query already exists for prevYear, generalize it)
   - Update `pieRows` to include `compareAmount` and recalculate `changePct` against compareYear instead of year-1
   - Pass `compareYear` and compare data to BudgetPieTable

2. **BudgetPieTable.tsx** — Render comparison columns
   - Update `PieRow` interface: add `compareAmount?: number`, `compareValue?: number`
   - Update colgroup: add comparison column (hidden when compare inactive)
   - Render comparison amount cell
   - Update change badge to use compareYear diff
   - Optional: dual-ring pie chart

3. **Locale files** — Add i18n keys
   - `explorer.compare` → "Jämför"
   - `explorer.compareYear` → "Jämför med"
   - `explorer.change` → "Förändring"

### Data Flow

```
Explorer state:
  selectedYear = 2025
  compareYear = 2020  (user-selected, default: selectedYear - 1)
  compareActive = true/false

Queries:
  budgetData       ← getBudgetByYear(selectedYear)     [existing]
  compareBudgetData ← getBudgetByYear(compareYear)     [new, enabled: compareActive]
  yearData         ← years.find(selectedYear)           [existing]
  compareYearData  ← years.find(compareYear)            [new]

pieRows computation:
  for each area:
    rawAmount     = current year nominal SEK
    value         = convertAmount(rawAmount, mode, yearData, total)
    compareAmount = compare year nominal SEK (from compareBudgetData)
    compareValue  = convertAmount(compareAmount, mode, compareYearData, compareTotal)
    changePct     = ((rawAmount - compareAmount) / compareAmount) * 100
```

### Implementation Steps

1. **Add comparison state & controls to Explorer.tsx**
   - Toggle button + year dropdown next to existing YearPicker
   - Only show when `compareActive` is true
   - Generalize `prevBudgetData` query to use `compareYear` instead of hardcoded `selectedYear - 1`

2. **Update PieRow interface & pieRows computation**
   - Add `compareAmount`, `compareValue` to PieRow
   - Calculate against compareYear data

3. **Update BudgetPieTable columns**
   - Add comparison column to colgroup (conditional width)
   - Render comparison amount
   - Keep change badge, now using user-selected comparison year

4. **Add i18n keys** (sv.json + en.json)

5. **Test responsive layout** — verify table doesn't overflow on mobile with extra column

### Files to Touch
- `src/components/explorer/Explorer.tsx` — state, queries, controls
- `src/components/explorer/BudgetPieTable.tsx` — table columns, PieRow type
- `src/locales/sv.json` — comparison labels
- `src/locales/en.json` — comparison labels

### Edge Cases
- Compare year has no data → show "—" in compare column
- Same year selected → disable or show warning
- Very old years (pre-2000) may have sparse data
- Display mode changes should recalculate both years' values
- MobileBarList is unused dead code — can be deleted as cleanup

### Optional Enhancements
- Sort by biggest change (absolute or %) when comparison is active
- Highlight rows where the ranking changed (area moved up/down)
- Dual-ring pie: outer ring = current year, inner ring = compare year
