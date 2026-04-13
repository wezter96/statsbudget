# Statsbudget

Civic-data explorer for the Swedish state budget. Follow expenditure from 2000 to today, drill into anslag, compare across decades with curated 1975/1980/1985 snapshots.

Live site: [statsbudget.se](https://statsbudget.se)

**Built with AI.** Data is sourced from official open datasets (ESV, SCB, Riksdagen) and structured with LLM assistance. Individual numbers may contain errors — report them via the in-app feedback form on `/about#rapportera-fel`.

## Tech

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Charts**: Apache ECharts (pie / stacked area) with perceptually distinct palette (min ΔE76 ≈ 15)
- **State / URL sync**: `nuqs`-style query params via `react-router-dom`
- **i18n**: `react-i18next`, Swedish default, English stubbed
- **Backend**: Supabase (Postgres) — star schema with `dim_year`, `dim_area`, `dim_anslag`, `dim_party`, `fact_budget`, `fact_historical`
- **Edge functions** (Deno): `og` (SVG OG image), `submit-issue` (feedback → GitHub Issues)
- **Analytics**: Plausible (no cookies, no consent banner)

## Data sources

| Source | Dataset | Coverage |
|---|---|---|
| ESV / Statskontoret | Årsutfall statsbudget per utgiftsområde + anslag (CSV, CC0) | 1997–2025 |
| ESV / Statskontoret | Månadsutfall inkomster (CSV/ZIP) | 2006–pågående |
| SCB PxWebApi 2 | KPI fastställda årsmedel (TAB4352) | 1980–2025 |
| SCB PxWebApi 2 | BNP till marknadspris, löpande priser (TAB4553) | 1981–2025 |
| Riksdagen | Finansutskottets betänkanden 1975:FiU48, 1979/80:FiU50, 1984/85:FiU37 | 1975/76, 1980/81, 1985/86 |

All seeding is idempotent. See `scripts/seed.ts`, `scripts/skatteintakter/seed-skatteintakter.ts`, and `scripts/seed-historical.ts`.

## Local development

Requires **Bun ≥ 1.3** and **Node ≥ 20** (for a few dev-time bits).

```bash
bun install
bun run dev       # http://localhost:47319
```

The dev server runs on port 47319 (uncommon on purpose). `/api/og` is served by an in-process Vite middleware.

### Environment

Create `.env.local`:

```bash
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<anon-key>"
VITE_SITE_URL="https://www.example.com" # Optional locally; the Pages workflow sets this automatically
VITE_PLAUSIBLE_DOMAIN="www.example.com" # Optional
# Used by seed scripts only — never commit.
DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
```

`DATABASE_URL` must be the Supabase **Session pooler** URL (port 5432, IPv4).

## GitHub Pages deployment

The project is now set up for GitHub Pages with pretty URLs for `/`, `/about`, and `/historical`.

1. In **Settings → Pages**, set the source to **GitHub Actions** and add your custom domain there first.
2. Add repository **Variables** for the client build:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_PLAUSIBLE_DOMAIN` (optional)
   - `VITE_PLAUSIBLE_SCRIPT_SRC` (optional; defaults to `https://plausible.io/js/script.js`)
3. Deploy the Supabase Edge Functions used in production:

```bash
supabase functions deploy og
supabase functions deploy submit-issue
```

4. Push to the default branch, or run the **Deploy GitHub Pages** workflow manually.

The workflow uses `actions/configure-pages` to pass the correct Pages `base_url` and `base_path` into the Vite build, so the same artifact works both on the temporary `*.github.io` URL and on your final custom domain. The build now emits Pages-specific artifacts such as `404.html`, route entry points for `/about` and `/historical`, `.nojekyll`, and generated `robots.txt` / `sitemap.xml`.

Open Graph images are served directly from the Supabase `og` Edge Function because GitHub Pages cannot rewrite `/api/*` routes in production.

### Database + seed

```bash
# Apply schema + seed modern (2000–2025) ESV + SCB data
bun --env-file=.env.local scripts/seed.ts

# Seed tax revenue annual series + monthly outcomes from Statskontoret/ESV
bun --env-file=.env.local scripts/skatteintakter/seed-skatteintakter.ts

# Seed 1975/1980/1985 historical snapshots from Riksdagen betänkanden
bun --env-file=.env.local scripts/seed-historical.ts
```

### Generate Supabase types

```bash
export PATH="$HOME/.local/bin:$PATH"
set -a && . ./.env.local && set +a
supabase gen types typescript --db-url "$DATABASE_URL" --schema public \
  > src/integrations/supabase/types.ts
```

## Project structure

```
src/
  components/       React UI (Hero, Layout, Footer, FeedbackForm, AiDisclosureBanner, SourceLink)
    explorer/       BudgetPieTable, TimeSeriesChart, CategoryFilter, DeltaBarChart, MobileBarList
  lib/
    palette.ts      60-color perceptually distinct palette + stableColor(name)
    sources.ts      Central registry of external data sources
    budget-queries.ts  Typed Supabase queries
  pages/            Index, Historical, About, NotFound
  locales/          sv.json (English stubbed, all strings Swedish in v1)
scripts/
  seed.ts             ESV + SCB ETL (modern era)
  seed-historical.ts  Riksdagen FiU betänkande seeder
  og-renderer.ts      Shared SVG OG renderer
supabase/
  migrations/      DDL (star schema, fact_historical, dim_year metadata)
  functions/
    og/            Edge function serving production OG images
    submit-issue/  Edge function posting feedback to GitHub Issues
```

## Colors

`src/lib/palette.ts` generates a 60-color palette by greedy ΔE maximization in CIE Lab space. Every category name hashes to a deterministic slot so side-by-side comparisons (e.g. 1975 vs 2025) always use the same color for semantically related concepts. Adding a new category? Either let the hash handle it, or add an explicit slot in `CATEGORY_SLOTS`.

## Contributing

Spotted a wrong number? Open an issue or use the in-app form on the deployed `/about#rapportera-fel` page.

PRs welcome.

## License

TBD.
