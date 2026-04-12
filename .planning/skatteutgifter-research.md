# Skatteutgifter — Data Source Research

## Background

Skatteutgifter ("tax expenditures") are reductions in tax intake created by
exceptions, deductions or reduced rates compared to a benchmark tax system.
They do NOT appear as anslag in the expenditure side of the state budget. They
appear on the revenue side under inkomsttitel-serie 1700 ("skatteminskningar")
and as informational items in the annual Skatteutgiftsbilaga attached to the
budget proposition.

## Primary source — Regeringens Skatteutgiftsbilaga

The official ground truth. Published annually as a bilaga (appendix) to
budgetpropositionen, normally in September/October.

URLs to verify (the worktree has no network at run time; the seeder is built
to consume a CSV pulled from these PDFs):

- Landing page (search): https://www.regeringen.se/search?query=skatteutgifter+bilaga
- Most recent (BP 2025): https://www.regeringen.se/rattsliga-dokument/proposition/2024/09/prop-20242501/
  Bilaga 2 "Redovisning av skatteutgifter 2024" (PDF, ~80 pages, table per
  skatteutgift with Mkr per year, typically t-3 to t+1).
- BP 2024: https://www.regeringen.se/rattsliga-dokument/proposition/2023/09/prop.-2023241/
  Bilaga "Redovisning av skatteutgifter 2023".
- BP 2023: https://www.regeringen.se/rattsliga-dokument/proposition/2022/11/prop.-2022231/
- Skatteverket — accumulated overview: https://www.skatteverket.se/

Format: PDF only (no machine-readable XLSX is published officially). Each
bilaga contains a master table with columns roughly:

  Skatteutgift | 2022 (utfall) | 2023 (prognos) | 2024 (prognos) | 2025 (prognos)

amounts in Mkr. ~150 line items grouped by tax base (inkomstskatt fysiska
personer, kapital, mervärdesskatt, punktskatter etc.).

Coverage in a single bilaga: ~4 years (1 utfall + 3 prognos). To get a 5–10
year history we need to stitch multiple bilagor (BP 2018 → BP 2025).

## Secondary source — ESV Inkomster utfall (1700-serien)

ESV publishes inkomstutfall on https://www.esv.se/statsbudgetens-utveckling/
and https://www.statskontoret.se/psidata/arsutfall/. The CSV titled
"arsutfall_inkomster_<year>.csv" mirrors the structure of the utgift CSV
seeded by `scripts/seed.ts` but with inkomsttitel codes. Lines starting with
"17xx" carry the realised skatteminskning amounts at aggregated level (not
per item) — useful as a sanity-check total but NOT a substitute for the
bilaga because individual ROT/RUT/ISK numbers aren't broken out.

URL pattern (verify with HEAD request before download):
  https://www.esv.se/contentassets/<hash>/arsutfall-inkomster-<year>.csv

## Tertiary — Skatteverket statistikportal

https://www.skatteverket.se/omoss/varverksamhet/statistikochregister/skattpaarbete.4.html
Contains ROT/RUT-specific outturn data from 2008 onward (since the system was
introduced). Not used in the seed because the bilaga already covers it and
mixing sources would produce inconsistent vintages.

## Honest data status (what the seeder ships)

The worktree has no network access, no PDF parser, and no DATABASE_URL. The
seeder ships:

1. A vetted **master list** of 12 important skatteutgifter (`MASTER_LIST` in
   `scripts/skatteutgifter/fetch-skatteutgifter.ts`). These are real items
   that appear in every recent bilaga, with stable codes the user can map
   manually.
2. A **stub fact loader** that reads `data/skatteutgifter.csv` if present
   (CSV format documented in the seeder README). When the user has run the
   seeder against a real CSV exported from the bilaga, real data flows in.
3. NO fabricated yearly amounts. If no CSV is supplied the fact table stays
   empty and the UI surfaces a "data saknas" notice.

## Master list — to seed into `dim_skatteutgift`

| code | name_sv | name_en | UO mapping | order of magnitude (Mkr/yr, recent) | description |
|---|---|---|---|---|---|
| ROT | ROT-avdrag | ROT tax credit | UO18 | ~10 000 | Skattereduktion för reparation/ombyggnad av bostad |
| RUT | RUT-avdrag | RUT tax credit | UO14 | ~6 000 | Skattereduktion för hushållsnära tjänster |
| RANTEAVDRAG | Avdrag för räntekostnader | Mortgage interest deduction | UO18 | ~25 000 | 30% skattereduktion på räntekostnader (21% över 100 kkr) |
| ISK | Schablonbeskattning ISK/KF | ISK low-rate capital tax | UO02 | ~12 000 | Reducerad kapitalbeskattning av investeringssparkonto |
| JOBBSKATTE | Jobbskatteavdrag | Earned income tax credit | UO14 | ~140 000 | Skattereduktion för arbetsinkomster |
| GRUNDAVDRAG | Förhöjt grundavdrag pensionärer | Enhanced basic allowance pensioners | UO11 | ~22 000 | Förhöjt grundavdrag för personer 66+ |
| RESEAVDRAG | Reseavdrag | Commuting deduction | UO22 | ~5 500 | Avdrag för resor till och från arbetet |
| EXPERT | Expertskatt | Expert tax relief | UO24 | ~600 | 25% skattefrihet för utländska nyckelpersoner |
| MOMS_LIVS | Reducerad moms livsmedel | Reduced VAT food (12%) | UO23 | ~30 000 | 12% istället för 25% moms |
| MOMS_KULTUR | Reducerad moms kultur/idrott | Reduced VAT culture/sports (6%) | UO17 | ~5 000 | 6% istället för 25% moms |
| ENERGI_IND | Energiskattenedsättning industri | Energy tax reduction industry | UO21 | ~3 500 | Lägre energiskatt för tillverkningsindustri |
| GAVO | Gåvoskattereduktion | Charity giving credit | UO17 | ~250 | Skattereduktion för gåvor till godkända mottagare |

Magnitudes are illustrative only (rounded from BP 2024 / BP 2025 bilagor) and
are NOT loaded into the fact table.

## Open questions / TODOs for the human operator

1. Decide whether to parse the bilaga PDFs with `pdfplumber` (Python) or by
   hand-exporting the master table to CSV. Hand export is faster for one
   vintage; scripted parsing pays off when stitching 8+ years.
2. Confirm UO mapping with a domain reviewer — several items (e.g. ISK)
   could plausibly map to several utgiftsområden.
3. Decide whether to expose the gross "skatteutgift" amount or the
   "nettoskattebortfall" (some items have second-order effects). The bilaga
   reports the bruttoutgift; that's what we seed.
