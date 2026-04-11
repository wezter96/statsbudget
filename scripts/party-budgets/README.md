# Party Shadow Budget Pipeline

Seeds `fact_budget` with `budget_type = 'shadow_delta'` rows per party per
utgiftsområde per year. Powers the "Jämför partier" view in the explorer.

## Pipeline stages

```
  Riksdagen API                Claude API                Postgres
 (listBudgetMotions)       (extractDeltas, tools)      (fact_budget)
        |                         |                           ^
        v                         v                           |
  MotionDoc[] --fetch text--> ExtractedDelta[] --reconcile--> SeedRow[]
                                                               |
                                                               +--> SQL migration
                                                                    (fallback)
```

Each stage is a module in this directory:

| file | role |
|------|------|
| `fetch-motions.ts` | Riksdagen open-data client + on-disk cache (`.cache/`) |
| `extract-deltas.ts` | LLM extraction via Claude messages/tools API; stub fallback |
| `stub-extract.ts` | Deterministic fabricated deltas keyed on `(year, partyCode)` |
| `reconcile.ts` | Schema checks, outlier rejection, ±5% total check, dedupe |
| `seed-shadow-budgets.ts` | Orchestrator; chooses DB insert or SQL emit |
| `types.ts` | Shared TS types |
| `SOURCES.md` | Riksdagen API reference + verified example URLs |

## Running it

### Dev (stub mode — no credentials needed)

```bash
bun scripts/party-budgets/seed-shadow-budgets.ts \
  --years 2024,2025 \
  --parties S,M,SD,C,V,KD,MP,L
```

With no `ANTHROPIC_API_KEY` and no `DATABASE_URL`, the pipeline:

1. Skips Riksdagen fetch (nothing to send to the LLM anyway)
2. Generates deterministic stub deltas via `stub-extract.ts`
3. Writes a migration file at
   `supabase/migrations/20260412120000_shadow_seed.sql` that you can apply
   manually through the Supabase dashboard / `supabase db push`.

Re-running overwrites the migration file and the SQL is idempotent (it
`DELETE`s the scoped shadow_delta rows before re-inserting).

### Real extraction (requires an Anthropic key)

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6   # optional, this is the default

bun scripts/party-budgets/seed-shadow-budgets.ts \
  --years 2024,2025 \
  --parties S,M,SD,C,V,KD,MP,L
```

The pipeline will:

1. List motions via `data.riksdagen.se/dokumentlista/?doktyp=mot&parti=...`.
2. Pick the "med anledning av prop. YYYY/YY:1" motion.
3. Fetch `dokument_url_text` (plain text preferred over HTML).
4. Cache the raw text under `scripts/party-budgets/.cache/YYYY_YY/PARTY/`.
5. Ask Claude (sonnet-4-6) via the Messages API with the `report_budget_deltas`
   tool to return strictly-typed `{ area_code, delta_mkr, confidence, source_quote }[]`.
6. Reconcile (range check, dedupe, ±5% total sanity).
7. Insert into `fact_budget` (if `DATABASE_URL` set) or emit SQL migration.

Force stub even when a key is present:

```bash
USE_STUB=true bun scripts/party-budgets/seed-shadow-budgets.ts ...
```

### Writing straight to the DB

Set `DATABASE_URL` to the Supabase session-pooler connection string. The
pipeline normalizes the URL and enforces `sslmode=require`. It uses Bun's
native `Bun.SQL` client:

```bash
export DATABASE_URL='postgresql://postgres.xxxx:pw@aws-0-eu-north-1.pooler.supabase.com:5432/postgres'
export ANTHROPIC_API_KEY=sk-ant-...
bun scripts/party-budgets/seed-shadow-budgets.ts --years 2024,2025 --parties S,M,SD,C,V,KD,MP,L
```

The orchestrator wraps deletes + inserts in a single transaction.

## Environment variables

| var | purpose | required? |
|-----|---------|-----------|
| `ANTHROPIC_API_KEY` | enable real LLM extraction | no (stub fallback) |
| `ANTHROPIC_MODEL`   | override model id | no (default `claude-sonnet-4-6`) |
| `USE_STUB`          | force stub even when key present | no |
| `DATABASE_URL`      | direct Postgres connection | no (SQL-emit fallback) |

## CLI flags

| flag | default | meaning |
|------|---------|---------|
| `--years` | `2024,2025` | comma-separated riksmöte end-years |
| `--parties` | `S,M,SD,C,V,KD,MP,L` | party codes from `dim_party` |
| `--emitSql` | off | force SQL-migration output even if DB creds present |
| `--skipFetch` | auto | skip Riksdagen fetch (used automatically in stub mode) |

## Data contract

Rows produced have the shape expected by the existing `dim_party` /
`fact_budget` star schema:

```ts
{
  year_id:            number,   // e.g. 2024
  area_id:            number,   // 1..27  (UO01..UO27)
  anslag_id:          null,     // rollup row
  party_id:           number,   // 2..10  (S..ALLIANSEN)
  budget_type:        'shadow_delta',
  amount_nominal_sek: number,   // Mkr, positive = more than gov
  is_revenue:         false
}
```

`amount_nominal_sek` is stored in **Mkr** (millions SEK) to match the rest
of the pipeline — it is a misnomer kept for historical reasons.

## What the stub does NOT simulate

- Political news cycles / one-off spending shocks
- Revenue-side deltas (we only write `is_revenue=false`)
- Anslag-level (sub-UO) detail
- `declared_total_mkr` reconciliation (stub declares none)

These only work with real LLM extraction.

## Troubleshooting

- **"HTTP 404 for .../dokumentlista"**: double-check `rm` format — must be
  URL-encoded `2023%2F24` with the prior year on the left.
- **"Claude returned no tool_use block"**: usually the model refused because
  the text was too short or garbled. Inspect
  `scripts/party-budgets/.cache/.../PARTY/_list.json` and the cached motion
  text. Re-run with `USE_STUB=true` as a workaround while debugging.
- **"DATABASE_URL not set" when you did set it**: Bun's `.env.local` loading
  is scoped to `cwd` — run the script from the repo root.
