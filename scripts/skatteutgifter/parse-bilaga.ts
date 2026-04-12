// Parse the full skatteutgiftsbilaga text dump and regenerate the canonical
// MASTER_LIST + bilaga CSV. Run this once per new bilaga vintage.
//
// Usage:
//   pdftotext -layout data/skr-2024-25-98.pdf data/skr-2025-98.txt   # already done
//   bun scripts/skatteutgifter/parse-bilaga.ts
//
// Outputs:
//   scripts/skatteutgifter/master-list.json
//   data/skatteutgifter-bilaga.csv   (2024, 2025, 2026 for every item with numbers)
//
// Items with dash ("-") or "u" in all three columns are still emitted as dim
// rows (so the UI can list them) but no fact rows are written. Items with a
// sanction value (negative) are preserved as-is — the UI handles sign.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

interface ParsedRow {
  code: string;          // Bilaga code: A1, B12, G11 …
  section: string;       // A / B / C / D / E / F / G
  area: string | null;   // UO01..UO27 or null (for "ST" / staten)
  name_sv: string;
  v2024: number | null;
  v2025: number | null;
  v2026: number | null;
}

// Section headers in skr. 2024/25:98:
//   Tabell 2.2  A. Inkomst av tjänst och allmänna avdrag
//   Tabell 2.3  B. Intäkter och kostnader i näringsverksamhet
//   Tabell 2.4  C. Intäkter och kostnader i kapital
//   Tabell 2.5  D. Socialavgifter och särskild löneskatt
//   Tabell 2.6  E. Mervärdesskatt
//   Tabell 2.7  F. Punktskatter
//   Tabell 2.8  G. Skattereduktioner
const SECTION_HEADINGS: Record<string, string> = {
  A: 'Inkomst av tjänst och allmänna avdrag',
  B: 'Intäkter och kostnader i näringsverksamhet',
  C: 'Intäkter och kostnader i kapital',
  D: 'Socialavgifter och särskild löneskatt',
  E: 'Mervärdesskatt',
  F: 'Punktskatter',
  G: 'Skattereduktioner',
};

// Row pattern: optional leading space, code, area (UO\d+ or ST), name (lazy),
// then exactly three value tokens at end of line. Value tokens can be
// "d+,dd", "-d+,dd", "0,00", "-", "u", or blank.
const VALUE_TOKEN = /(?:-?\d+(?:,\d+)?|-|u)/;
const ROW_REGEX = new RegExp(
  `^\\s*([A-G]\\d{1,2})\\s+(UO\\d{2}|ST)\\s+(.+?)\\s{2,}(${VALUE_TOKEN.source})\\s+(${VALUE_TOKEN.source})\\s+(${VALUE_TOKEN.source})\\s*$`,
);
// Continuation line: indented, no code, no trailing numbers.
const CONT_REGEX = /^\s{10,}([^\d\-][^\n]*?)$/;

function parseValue(token: string): number | null {
  if (token === '-' || token === 'u' || token === '') return null;
  return parseFloat(token.replace(',', '.'));
}

function toMkr(mdKr: number | null): number | null {
  if (mdKr === null) return null;
  return Math.round(mdKr * 1000);
}

async function main() {
  const txtPath = resolve(REPO_ROOT, 'data', 'skr-2025-98.txt');
  const text = await readFile(txtPath, 'utf8');
  const lines = text.split('\n');

  const rows: ParsedRow[] = [];
  // Track the current section letter by remembering the last code we saw.
  // The PDF emits sections in order A → G, so we just read the code letter.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(ROW_REGEX);
    if (!m) continue;
    const [, code, area, namePart, t1, t2, t3] = m;
    let name = namePart.trim();
    // Look ahead for continuation lines (name wraps).
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      // Stop if next line has a code (new row) or is blank/table header.
      if (ROW_REGEX.test(next)) break;
      if (!next.trim()) break;
      // Skip page break / chapter boundary / table footer artefacts.
      if (/^\s*(Skr\.|Tabell|Skatteutgifter|\d+\s*$)/.test(next)) break;
      // If the next line looks like a new paragraph in the descriptive part
      // (indented heading with no value), we've left the table.
      if (/^\s*[A-G]\.\d/.test(next)) break;
      // Continuation: indented text-only line.
      const contMatch = next.match(CONT_REGEX);
      if (!contMatch) break;
      name += ' ' + contMatch[1].trim();
      i++;
    }
    rows.push({
      code,
      section: code[0],
      area: area === 'ST' ? null : area,
      name_sv: name.replace(/\s+/g, ' ').trim(),
      v2024: parseValue(t1),
      v2025: parseValue(t2),
      v2026: parseValue(t3),
    });
  }

  // Sort: section letter, then numeric code order.
  rows.sort((a, b) => {
    if (a.section !== b.section) return a.section < b.section ? -1 : 1;
    const na = parseInt(a.code.slice(1), 10);
    const nb = parseInt(b.code.slice(1), 10);
    return na - nb;
  });

  // Assign stable numeric IDs: A=1000-range, B=2000, C=3000, D=4000, E=5000, F=6000, G=7000.
  const letterToBase: Record<string, number> = {
    A: 1000,
    B: 2000,
    C: 3000,
    D: 4000,
    E: 5000,
    F: 6000,
    G: 7000,
  };

  const masterList = rows.map((r, idx) => ({
    skatteutgift_id: letterToBase[r.section] + parseInt(r.code.slice(1), 10),
    code: r.code,
    name_sv: r.name_sv,
    name_en: '',
    description_sv: `Skatteutgift ${r.code} enligt regeringens skatteutgiftsbilaga (skr. 2024/25:98), kategori ${r.section}. ${SECTION_HEADINGS[r.section]}.`,
    description_en: '',
    thematic_area_code: r.area,
    sort_order: idx * 10,
    section: r.section,
  }));

  // Write master-list.json
  const masterPath = resolve(__dirname, 'master-list.json');
  await writeFile(masterPath, JSON.stringify(masterList, null, 2) + '\n', 'utf8');
  console.log(`[parse-bilaga] wrote ${masterList.length} dim rows to ${masterPath}`);

  // Write CSV. Only include rows where at least one value is non-null.
  const csvLines = [
    '# Auto-generated by scripts/skatteutgifter/parse-bilaga.ts from data/skr-2025-98.txt',
    '# Source: Regeringens skr. 2024/25:98 "Redovisning av skatteutgifter 2025".',
    '# Column 2024 = utfall, 2025/2026 = prognos. Amounts in Mkr (×1000 from Mdkr in bilaga).',
    '# Do NOT hand-edit; re-run the parser. For items NOT in the bilaga, use skatteutgifter-extras.csv.',
    'year,code,amount_mkr,is_estimated',
  ];
  let factCount = 0;
  for (const r of rows) {
    const cols: Array<[number, number | null, boolean]> = [
      [2024, r.v2024, false],
      [2025, r.v2025, true],
      [2026, r.v2026, true],
    ];
    for (const [year, rawMdKr, est] of cols) {
      const mkr = toMkr(rawMdKr);
      if (mkr === null) continue;
      csvLines.push(`${year},${r.code},${mkr},${est}`);
      factCount++;
    }
  }
  const csvPath = resolve(REPO_ROOT, 'data', 'skatteutgifter-bilaga.csv');
  await writeFile(csvPath, csvLines.join('\n') + '\n', 'utf8');
  console.log(`[parse-bilaga] wrote ${factCount} fact rows to ${csvPath}`);

  // Report items with no numbers at all (dim row but no facts).
  const empty = rows.filter(r => r.v2024 === null && r.v2025 === null && r.v2026 === null);
  console.log(`[parse-bilaga] items with no data: ${empty.length}`);
  for (const e of empty.slice(0, 20)) {
    console.log(`  ${e.code.padEnd(4)} ${e.name_sv.slice(0, 70)}`);
  }
}

main().catch(err => {
  console.error('[parse-bilaga] FAILED:', err);
  process.exit(1);
});
