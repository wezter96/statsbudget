# Riksdagen Open Data — Budget Motion Sources

This document maps out how to discover and fetch Swedish party budget motions
("budgetmotioner") from the Riksdagen open data API for downstream LLM
extraction into `fact_budget` as `shadow_delta` rows.

All endpoints below were verified live against `data.riksdagen.se` while
building this pipeline. The API has no auth, is JSON-native, and is stable.

## 1. Document listing endpoint

```
https://data.riksdagen.se/dokumentlista/?{params}&utformat=json
```

Useful query parameters for our use case:

| param | meaning | value we use |
|-------|---------|--------------|
| `doktyp` | document type | `mot` (motion) |
| `parti` | party filter | `S`, `M`, `SD`, `C`, `V`, `KD`, `MP`, `L` |
| `rm` | riksmöte ("parliamentary year") | e.g. `2023/24`, must be URL-encoded `2023%2F24` |
| `sok` | free-text search | `"med anledning av budgetpropositionen"` to narrow to budget motions |
| `sz` | page size | up to ~500 |
| `p` | page index | 1-based |
| `utformat` | response format | `json` (default is XML) |

The top-level response has:
- `dokumentlista.@traffar` — total hit count
- `dokumentlista.@sidor` — total pages
- `dokumentlista.dokument[]` — array of result items

Each `dokument` item contains (fields relevant to us):
- `dok_id` — stable document id, e.g. `HB022772`
- `rm` — parliamentary year, e.g. `2023/24`
- `beteckning` — motion number, e.g. `2772`
- `titel` / `undertitel` — human title and author line
- `organ` — committee (`FiU` = finansutskottet; the main budget motion goes here)
- `datum` — publish date
- `dokument_url_text` — protocol-relative URL to plain-text version (preferred)
- `dokument_url_html` — protocol-relative URL to HTML version
- `filbilaga.fil[]` — attachments (usually `.docx` and `.pdf`)

## 2. Document full-text endpoint

For extraction we prefer plain text:

```
https://data.riksdagen.se/dokument/{dok_id}.text
```

(The URL in `dokument_url_text` is protocol-relative — prepend `https:`.)

HTML fallback:

```
https://data.riksdagen.se/dokument/{dok_id}.html
```

If neither is available, `filbilaga.fil[]` holds PDFs/DOCX attachments at
`https://data.riksdagen.se/dokument/{filename}` — we skip those in stub mode
and TODO-note them in real mode.

## 3. Verified 2024 budget-motion examples (riksmöte 2023/24)

These URLs were fetched and confirmed live. They are representative — the
actual main "skuggbudget" motion for each party is the one filed by the party
leader referencing `prop. 2023/24:1` (the government budget proposition).

### S — Socialdemokraterna
Listing:
```
https://data.riksdagen.se/dokumentlista/?sok=med+anledning+av+budgetpropositionen&doktyp=mot&parti=S&rm=2023%2F24&utformat=json
```
Example hit (spring amendment; similar pattern for fall budget):
- `dok_id`: `HB022894`
- Titel: "med anledning av prop. 2023/24:100 2024 års ekonomiska vårproposition"
- Undertitel: "av Magdalena Andersson m.fl. (S)"
- Full text: https://data.riksdagen.se/dokument/HB022894.text

### M — Moderaterna
Listing:
```
https://data.riksdagen.se/dokumentlista/?doktyp=mot&parti=M&rm=2023%2F24&utformat=json&sz=5
```
Examples returned:
- `HB022772` — "med anledning av prop. 2023/24:32 Tilläggsskatt..." — https://data.riksdagen.se/dokument/HB022772.text
- `HB022641` — "Skärpta insatser mot bidragsfusk" — https://data.riksdagen.se/dokument/HB022641.text

Since M is a governing party in 2023/24 they don't file a shadow budget;
the pipeline skips governing-coalition parties when the requested year is
one where they held government. This is detected heuristically from the
absence of a `med anledning av prop. 2023/24:1` motion in their listing.

### SD — Sverigedemokraterna
Listing:
```
https://data.riksdagen.se/dokumentlista/?sok=budget&doktyp=mot&parti=SD&rm=2023%2F24&utformat=json
```
Example:
- `HB022697` — https://data.riksdagen.se/dokument/HB022697.text

### Other parties
Same pattern with `parti=C|V|KD|MP|L`.

## 4. Filtering strategy used by `fetch-motions.ts`

1. Query the listing with `doktyp=mot&parti={CODE}&rm={YEAR-1}%2F{YY}&sok=budgetproposition`.
2. Keep only items whose `titel` starts with `"med anledning av prop. {YEAR-1}/{YY}:1"`
   (the main fall budget proposition) OR `"...prop. ...:100 ... vårproposition"`
   (spring amendment) — these are the actual shadow budget/reply motions.
3. If no match, fall back to broadest item whose title contains the word
   `budget` and whose `organ` is `FiU`.
4. Dedupe by `dok_id`, prefer `dokument_url_text`, fall back to HTML, skip PDFs.

## 5. Rate-limiting & caching

The API is generous but we cache raw text under
`scripts/party-budgets/.cache/{rm}/{parti}/{dok_id}.txt` to avoid re-fetching
during extraction iteration. Cache is keyed by `dok_id` so it's stable.

## 6. What we intentionally do NOT do

- We do not parse PDFs. If a party only supplies a PDF we log it and skip.
- We do not try to reconcile at the `anslag` level — only at `utgiftsområde`
  (UO01..UO27), matching the current `fact_budget(area_id, anslag_id=NULL)`
  rollup rows.
