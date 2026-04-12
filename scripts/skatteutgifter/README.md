# Skatteutgifter seeder

Seeds the `dim_skatteutgift` and `fact_skatteutgift` tables for the
Statsbudget skatteutgifter (tax expenditures) layer.

## Run

```bash
# Dry mode — works without DATABASE_URL, prints what it would do
bun run scripts/skatteutgifter/seed-skatteutgifter.ts

# Real run
DATABASE_URL=postgres://... bun run scripts/skatteutgifter/seed-skatteutgifter.ts
```

The seeder is idempotent: dim is upserted, facts are truncated and reinserted.

## Master list

12 hand-curated skatteutgifter live in `fetch-skatteutgifter.ts` as
`MASTER_LIST`. Codes are stable; do not renumber existing IDs.

## Yearly amounts

Real amounts are NOT hardcoded. Place a CSV at `data/skatteutgifter.csv`:

```csv
year,code,amount_mkr,is_estimated
2023,ROT,9800,false
2024,ROT,11200,true
2023,RUT,5600,false
...
```

Source the numbers from regeringens skatteutgiftsbilaga (PDF, BP 2024 / BP 2025).
See `.planning/skatteutgifter-research.md` for source URLs.

## What is shipped vs missing

- Shipped: schema migration, master list of 12 important items, CSV loader,
  idempotent seeder, dry mode for offline verification.
- Missing: a verified multi-year CSV. The seeder will run with an empty
  fact table if no CSV is supplied — the UI handles the empty state. Do NOT
  fabricate yearly amounts; extract them from the bilaga.
