# Shadow budget sources

Audit log for the per-UO deltas in `data/shadow-budget-2025.csv` and
`data/shadow-budget-2026.csv`. Every number in those CSVs is traceable back
to the exact table heading listed below.

Extraction method: `pdftotext -layout <file>.pdf` followed by tokenization
of the summary table (split on runs of 2+ spaces, last column = delta). For
each party × year, the extracted total `Summa utgiftsområden` was reconciled
against the value printed in the PDF — all 8 combinations matched to the
tkr.

## 2025 budget cycle (motions filed Oct 2024 against BP25 / prop. 2024/25:1)

### S — Socialdemokraterna
- Motion: `Mot. 2024/25:3199` — *Ett rikare och rättvisare Sverige*
- PDF: https://data.riksdagen.se/fil/BFEF120C-4ADE-4888-A8D8-753885AB18C7
- Table: **BILAGA 2 — Förslag till utgiftsramar för 2025, Tusental kronor** (p. 37)
- UO rows extracted: 27 / 27
- Reconciled total: 30 886 300 tkr = 30 886.3 mkr (matches `Summa utgiftsområden`)

### C — Centerpartiet
- Motion: `Mot. 2024/25:2962` — *Ny kraft för Sverige – Centerpartiets budgetmotion för 2025*
- PDF: https://data.riksdagen.se/fil/62496888-40E7-451D-AA9B-F1A47A7C56CD
- Table: **Tabell 6 — Förslag till utgiftsramar 2025, Tusental kronor** (p. 44)
- UO rows extracted: 27 / 27
- Reconciled total: 2 820 500 tkr = 2 820.5 mkr

### MP — Miljöpartiet
- Motion: `Mot. 2024/25:3220` — *Budget för en rättvis omställning – Miljöpartiets budgetmotion för 2025*
- PDF: https://data.riksdagen.se/fil/675F19E7-DA8F-49B8-977C-A4A8F3D25138
- Table: **Tabell A — Förslag till utgiftsramar 2025, Tusental kronor** (bilaga, p. 90)
- UO rows extracted: 27 / 27
- Reconciled total: 147 384 382 tkr = 147 384.382 mkr

### V — Vänsterpartiet
- Motion: `Mot. 2024/25:1924` — *För ett starkare Sverige – Klimat, välfärd och tillväxt. Vänsterpartiets budgetmotion för 2025*
- PDF: https://data.riksdagen.se/fil/06D97284-41A0-430E-A8FA-52B2DC39D86C
- Table: **Tabell 9 — Vänsterpartiets förslag till utgiftsramar 2025, Tusental kronor** (kap. 19, p. ~100)
- UO rows extracted: 27 / 27
- Reconciled total: 132 498 644 tkr = 132 498.644 mkr

### Parties skipped for 2025

- **M, KD, L** — Tidö coalition partners who file a joint motion identical to
  the regeringens proposition. Per spec, skipped (implicit 0 delta).
- **SD** — Support party to the Tidö government. A document search
  (`sok=Sverigedemokraterna+budget&rm=2024/25`) returned no independent
  budgetmotion from SD for the 2024/25 cycle; the only motions found were
  sakpolitiska motioner in individual utgiftsområden. Skipped.

## 2026 budget cycle (motions filed Oct 2025 against BP26 / prop. 2025/26:1)

### S — Socialdemokraterna
- Motion: `Mot. 2025/26:3551` — *Ny riktning för Sverige*
- PDF: https://data.riksdagen.se/fil/3ABE7735-F127-4A44-AA5D-F3080BEB47E4
- Table: **BILAGA 2 — Förslag till utgiftsramar för 2026, Tusental kronor** (p. 34)
- UO rows extracted: 27 / 27
- Reconciled total: 27 226 036 tkr = 27 226.036 mkr

### C — Centerpartiet
- Motion: `Mot. 2025/26:3811` — *En budget för framtiden – fler jobb och lägre utsläpp*
- PDF: https://data.riksdagen.se/fil/A210288E-0C9D-4EC8-914F-02FFCE0E7C5B
- Table: **Tabell 4 — Förslag till utgiftsramar 2026, Tusental kronor** (p. 60)
- UO rows extracted: 27 / 27
- Reconciled total: −5 035 357 tkr = −5 035.357 mkr (net *reduction* vs gov)

### MP — Miljöpartiet
- Motion: `Mot. 2025/26:3770` — *Sverige förtjänar bättre – Miljöpartiets budgetmotion för 2026*
- PDF: https://data.riksdagen.se/fil/B34DB875-7A81-462C-92C0-67678D9CCA59
- Table: **Tabell A — Förslag till utgiftsramar 2026, Tusental kronor** (bilaga, p. 86)
- UO rows extracted: 27 / 27
- Reconciled total: 136 327 536 tkr = 136 327.536 mkr

### V — Vänsterpartiet
- Motion: `Mot. 2025/26:2792` — *En ny regering – För ett starkare och tryggare Sverige*
- PDF: https://data.riksdagen.se/fil/CB6DA06B-3CBA-4298-BDD5-E38ADB8184F7
- Table: **Tabell 5 — Förslag till utgiftsramar 2026, Tusental kronor** (kap. 11, p. 75)
- UO rows extracted: 27 / 27
- Reconciled total: 64 957 900 tkr = 64 957.9 mkr

### Parties skipped for 2026

- **M, KD, L** — Same as 2025. Tidö partners, no independent motion.
- **SD** — Same as 2025. Document search for the 2025/26 cycle
  (`from=2025-10-01&tom=2025-11-30`) returned no SD-signed budgetmotion,
  only sakpolitiska motioner on individual UOs. Skipped.

## UO coverage per motion

Every motion's summary table covers all 27 utgiftsområden explicitly (rows
with `±0` are preserved as `delta_mkr=0` in the CSV). No UOs were dropped
due to unreadable rows, so `UO rows extracted = 27/27` holds for all 8
(party, year) combinations.

## Conversion notes

Every source table is printed in **tusental kronor** (tkr). The CSV stores
values in **miljoner kronor** (mkr) via `delta_mkr = tkr / 1000`. The
seeder then multiplies by 1 000 000 to produce the `amount_nominal_sek`
written to `public.fact_budget` (so `1 mkr = 1 000 000 SEK`).
