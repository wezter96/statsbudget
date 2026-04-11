# Shadow budget seeder

Populates `public.fact_budget` rows with `budget_type='shadow_delta'` from the
opposition parties' budgetmotioner vs. the regeringens budgetproposition.

## Files

- `data/shadow-budget-<year>.csv` — one row per (year, party, utgiftsområde)
  with columns `year,party_code,uo_code,delta_mkr,source_url,source_section`.
  `delta_mkr` is in **miljoner kronor** as printed in the source table.
  `source_url` points to the motion PDF; `source_section` names the exact
  table heading so a reviewer can audit every number.
- `scripts/shadow-budget/seed-shadow-budget.ts` — idempotent loader.
- `scripts/shadow-budget/SOURCES.md` — per (party × year) audit log.

## Running

```bash
# DRY (no DB writes): prints what it would insert
bun run scripts/shadow-budget/seed-shadow-budget.ts

# Live: requires DATABASE_URL in env (or .env.local, which bun auto-loads)
DATABASE_URL=postgres://... bun run scripts/shadow-budget/seed-shadow-budget.ts
```

For every (year, party) combination that exists in the CSVs, the seeder first
`DELETE`s the existing `shadow_delta` rows for that combo and then re-inserts.
Combos NOT present in the CSVs (e.g. M/KD/L who stand by the regeringens
budget) are left untouched. This makes re-runs safe and converging.

The seeder refuses to run if any CSV row references a `party_code` not in
`dim_party` or a `uo_code` not in `dim_area`.

## Adding next year's data

1. After the budgetproposition is released in September, wait for the opposition
   parties to file their budgetmotioner (usually within 20 days, deadline in
   early October).
2. Pull the document list for the cycle, e.g.:
   ```bash
   curl -sL "https://data.riksdagen.se/dokumentlista/?sok=budgetmotion&doktyp=mot&from=YYYY-10-01&tom=YYYY-11-30&utformat=json&sz=100"
   ```
3. For each party's main budgetmotion, download the PDF bilaga from
   `data.riksdagen.se/fil/<uuid>` and run `pdftotext -layout <file>.pdf`.
4. Locate the summary table titled `Förslag till utgiftsramar <year>`
   (Tusental kronor). It has one row per UO01..UO27 with a "Avvikelse från
   regeringen" column. Extract the delta in tkr and divide by 1000 to get
   mnkr.
5. Append rows to `data/shadow-budget-<year>.csv` keeping the same column
   order. Document the source in `SOURCES.md`.
6. Re-run the seeder. The `DELETE` step makes re-runs idempotent.

## Conventions

- Tidö parties M, KD, L file a joint motion that equals the government
  budget — the UI treats missing rows as delta 0, so don't seed them.
- SD has been a support party since 2022 and does NOT file an independent
  budgetmotion — skip them unless this changes in a future cycle.
- `±0` in the source table is recorded as `delta_mkr=0`.
- If a party provides only per-anslag deltas (not a per-UO table), sum them
  per UO manually — or drop that party with a note in `SOURCES.md`.
- Never fabricate numbers. A partial real dataset beats a complete fake one.
