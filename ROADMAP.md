# Statsbudget roadmap

Living list of work that is not yet done. Grouped by rough priority. Edit as things land or scope shifts.

---

## 🚧 Blockers for a production launch

### Deploy target
- **Status**: GitHub Pages via GitHub Actions.
- **Current launch checklist**:
  - In **Settings → Pages**, keep source set to **GitHub Actions**
  - Add custom domain `statsbudget.se` (and keep `www.statsbudget.se` redirect-compatible in DNS)
  - Set repo variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  - Optionally set `VITE_PLAUSIBLE_DOMAIN` / `VITE_PLAUSIBLE_SCRIPT_SRC`
  - Wait for the first successful Pages deploy, then enable **Enforce HTTPS**

### Supabase edge function deploy + secrets
- Need to run, once:
  ```
  supabase link --project-ref zpubqgkmjkbhygjgrwhu
  supabase functions deploy og --no-verify-jwt
  supabase functions deploy submit-issue --no-verify-jwt
  supabase secrets set GITHUB_TOKEN=github_pat_xxx GITHUB_REPO=wezter96/statsbudget
  ```
- Form currently returns `server_not_configured` until secrets are set.

### DNS for statsbudget.se
- Apex `statsbudget.se`: point `A` records to GitHub Pages (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`)
- `www.statsbudget.se`: point `CNAME` to `<user>.github.io`
- After propagation, confirm the repo's custom-domain setting and HTTPS certificate issuance

---

## 🎯 Deferred product features

### Option C — Party shadow budgets ("Jämför partier")
Button is currently disabled with a **SNART** badge. Turning it on requires:
1. **Fetch motions** from `https://data.riksdagen.se/dokumentlista/?sok=budgetmotion&avd=motion&format=json` for each opposition party, each fiscal year.
2. **LLM extraction**: feed each motion PDF/HTML to Claude/GPT → extract `{ year, party, area, delta_mkr }` per utgiftsområde vs. the government proposal.
3. **Reconciliation**: sum deltas per party per year, verify against totals stated in the motion summary (±1% tolerance), reject outliers.
4. **QA**: manually spot-check ~10% of extractions against the source PDF.
5. **Seed** into `fact_budget` with `budget_type='shadow_delta'`, `party_id` from `dim_party`.
6. **Scope v1**: 2020–2025 only (≈1 300 rows). Earlier years as a v2.
7. **UX**: re-enable `PartyToggle`, show a per-party legend in `DeltaBarChart`, add a confidence chip per party (extraction confidence score).

**Effort**: ~half-day engineering + ongoing maintenance each budget cycle.

### Phase 2 — AI chat drawer
Originally listed as out-of-scope in the Phase 1 spec but the user has expressed interest.
- Drawer with a conversational UI
- Tool-calling backend that lets the model query `fact_budget` / `fact_historical` and answer questions grounded in our data
- Needs: LLM API key (Anthropic), rate limiting, prompt injection guards, cost controls
- Implementation target: **Supabase Edge Function** for the LLM proxy so API key stays server-side

### Historical data quality pass
Known issues flagged by the research agent:
- **1975/76** — breakdown is a proxy from `FiU48` (1976/77 decision). Shape correct, absolute Mkr shifted ~8%. Verify against prop 1975:1 scan pp. 5–20 or replace with real values.
- **1985/86** — the "Kungl hov..." row with 31 468 Mkr is a known extraction bug; we skip it on seed, but the remainder should still be sanity-checked against `FiU37` opening table.
- **1980/81** — currently considered high confidence, no action.
- Add a visible **"osäker"** badge in the UI next to rows flagged uncertain (partially done — amber dot shown, but no tooltip explaining why).

### More historical snapshots
Spec only asked for 1975/80/85. Potential next snapshot years: 1990 (post-kronkris), 1995 (EU entry), 2000 (modern era starts — connect to ESV axis).

---

## ✨ Polish / nice-to-have UI

### Category filter — pie-table shortcut
Clicking a row in the Fördelning table (or a slice in the pie) should optionally *add* that category to the time-series filter as a quick "show me this over time" shortcut. Originally discussed; not built.

### Tooltip consistency
- TimeSeriesChart tooltip: already capped at top 8. Consider making the "+N fler" row clickable to open the full filter popover.
- DeltaBarChart tooltip: never revisited since the old design. Match the confined/ellipsis pattern of the others.

### Mobile polish
- Filter popover (`CategoryFilter`) doesn't yet have a bottom-sheet variant for narrow screens — it currently tries to render a 360px popover which overflows on phones.
- Historical page sticky sidebar collapses to stacked mobile, but the ordering (snapshots above, today pie below) could be smarter — maybe put the today pie first as a reference, then the snapshots.
- Hero text wrapping at very narrow widths.

### Year-range slider friction
Today it's a raw dual slider. Ideas:
- Snap to every 5 years visually
- Add preset buttons (5 år / 10 år / Alla)
- Display selected `yearFrom`–`yearTo` inline as an editable input

### A11y
- Run axe-core / Lighthouse against every route, log serious violations.
- Skip-to-content link exists but has never been manually tested.
- Confirm keyboard-only flow: year picker → mode toggle → pie/table → time series → filter popover → submit form.
- Chart text alternatives: add a visually-hidden `<table>` fallback under each chart with the raw numbers.

### SEO
- Per-year landing page metadata (`<title>Statsbudget 2024 — ...</title>`) once routing supports it.
- `/historical/1975`, `/historical/1980`, `/historical/1985` as real routes for deep linking.
- JSON-LD (Dataset schema) pointing at ESV/SCB.

### Analytics
- Decide whether to keep Plausible long-term. It is now environment-driven; leave `VITE_PLAUSIBLE_DOMAIN` unset to disable analytics, or set it to `statsbudget.se` / `www.statsbudget.se` in repo variables to enable it.

---

## 🛠 Tech debt

### Type safety
- `src/lib/budget-queries.ts` still does `supabase as any` for the `.from()` calls. With `types.ts` now populated we should drop the `as any` cast and let Supabase-js type-check the queries.

### Bundle size
- Production build is 1.2 MB / 385 KB gzipped, mostly ECharts. Worth code-splitting:
  - Pie chart module only on `/` and `/historical`
  - Line chart module only on `/`
  - Lazy-load ECharts via `React.lazy` per view.

### Tests
- Zero unit tests right now. Highest-value places to add:
  - `convertAmount()` arithmetic
  - `stableColor()` determinism + no-collisions smoke test
  - ESV CSV parser (tricky CSV; easy to break)
  - `seed-historical.ts` row-filter logic (the Kungl-hov skip)

### Data refresh automation
- ESV publishes updates twice yearly. Currently the seed has to be run manually. Options:
  - GitHub Action on a cron that runs `scripts/seed.ts` against the production DB
  - Or a Supabase scheduled function calling a lightweight edge function that does the ETL
  - Record `last_seeded_at` in a meta table so the hero "Senast uppdaterad" label shows the real timestamp instead of `new Date()`

### Env/secret hygiene
- `.env.local` is correctly git-ignored.
- Add a `.env.example` template so contributors know which keys to set.

### Project cleanup
- `src/components/ui/*.tsx` — many shadcn primitives are unused. Tree-shake or delete the unused ones to shrink the repo.

---

## ✅ Recently done (for context / don't reopen)

- Star schema + ESV + SCB seed, historical seed (1975/80/85)
- Pie + table primary view with stable colors (60-color CIE Lab palette, min ΔE ≈ 15)
- Category filter with Topp 5 / Topp 10 / Rensa, URL-synced
- `/api/og` SVG renderer (dev middleware + Supabase edge function)
- Sitemap + per-route canonical + og:image meta
- GitHub Pages support: dynamic site/base URL config, static route entry points, generated SEO files, Pages deployment workflow
- Rapportera fel form → GitHub Issues via Supabase edge function
- AI disclosure banner (dismissible) + footer note
- Rename Budgetkoll → Statsbudget (all code, URLs, metadata)
- Lovable references removed (`lovable-tagger` dep, `componentTagger` plugin)
- Root screenshot cleanup + placeholder asset removed
- Footer flattened (no duplicate Källor)
- Hero shrunk, filter bar split per section (År → Fördelning, mode/range/party → Utveckling över tid)
- Year dropdown limited to years with real budget data (2000–2025)
- Default year hydrates to latest automatically
- README rewritten
