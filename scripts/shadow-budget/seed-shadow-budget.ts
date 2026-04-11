// Idempotent seeder for shadow_delta rows in public.fact_budget.
//
// Reads data/shadow-budget-2025.csv and data/shadow-budget-2026.csv (columns:
// year,party_code,uo_code,delta_mkr,source_url,source_section) and writes one
// fact_budget row per data row with:
//   budget_type   = 'shadow_delta'
//   anslag_id     = NULL
//   party_id      = dim_party.party_id matching party_code
//   area_id       = dim_area.area_id matching uo_code
//   year_id       = year
//   amount_nominal_sek = delta_mkr * 1_000_000
//   is_revenue    = false
//
// Before inserting rows for each (year, party) combo present in the CSVs, the
// seeder DELETEs existing shadow_delta rows for that combo so re-runs converge.
// Rows for (year, party) combos NOT present in the CSVs are left alone.
//
// Usage:
//   DATABASE_URL=postgres://... bun run scripts/shadow-budget/seed-shadow-budget.ts
//
// If DATABASE_URL is not set, runs in DRY mode: prints planned operations and
// exits 0 without touching the DB.

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

type CsvRow = {
  year: number;
  party_code: string;
  uo_code: string;
  delta_mkr: number;
  source_url: string;
  source_section: string;
};

interface PgClient {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number }>;
  end: () => Promise<void>;
}

function parseCsv(text: string, filePath: string): CsvRow[] {
  // Simple CSV parser that handles quoted fields (no embedded quotes needed
  // for our data, but handle double-quoted source_section just in case).
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",");
  const expected = ["year", "party_code", "uo_code", "delta_mkr", "source_url", "source_section"];
  for (let i = 0; i < expected.length; i++) {
    if (header[i] !== expected[i]) {
      throw new Error(`${filePath}: expected header column ${i}=${expected[i]}, got ${header[i]}`);
    }
  }
  const out: CsvRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    // Tokenize with quote awareness.
    const tokens: string[] = [];
    let buf = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { tokens.push(buf); buf = ""; continue; }
      buf += ch;
    }
    tokens.push(buf);
    if (tokens.length !== 6) {
      throw new Error(`${filePath}: line ${li + 1} has ${tokens.length} fields, expected 6: ${line}`);
    }
    const delta = Number(tokens[3]);
    if (!Number.isFinite(delta)) {
      throw new Error(`${filePath}: line ${li + 1} non-numeric delta_mkr: ${tokens[3]}`);
    }
    out.push({
      year: Number(tokens[0]),
      party_code: tokens[1],
      uo_code: tokens[2],
      delta_mkr: delta,
      source_url: tokens[4],
      source_section: tokens[5],
    });
  }
  return out;
}

async function loadAllRows(): Promise<CsvRow[]> {
  const files = [
    resolve(REPO_ROOT, "data", "shadow-budget-2025.csv"),
    resolve(REPO_ROOT, "data", "shadow-budget-2026.csv"),
  ];
  const rows: CsvRow[] = [];
  for (const f of files) {
    const text = await readFile(f, "utf8").catch(() => "");
    if (!text) {
      console.warn(`[shadow-budget] missing ${f}, skipping`);
      continue;
    }
    rows.push(...parseCsv(text, f));
  }
  return rows;
}

async function maybeConnect(): Promise<PgClient | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  const { Client } = await import("pg").catch(() => {
    throw new Error("pg package not installed. Run: bun add pg");
  });
  const client = new Client({ connectionString: url }) as unknown as PgClient;
  await (client as unknown as { connect: () => Promise<void> }).connect();
  return client;
}

async function loadDims(client: PgClient): Promise<{
  parties: Map<string, number>;
  areas: Map<string, number>;
}> {
  const p = await client.query("select party_id, code from public.dim_party");
  const a = await client.query("select area_id, code from public.dim_area");
  const parties = new Map<string, number>();
  const areas = new Map<string, number>();
  for (const r of p.rows) parties.set(String(r.code), Number(r.party_id));
  for (const r of a.rows) areas.set(String(r.code), Number(r.area_id));
  return { parties, areas };
}

function validateCodes(
  rows: CsvRow[],
  parties: Map<string, number>,
  areas: Map<string, number>,
): void {
  const missingParty = new Set<string>();
  const missingArea = new Set<string>();
  for (const r of rows) {
    if (!parties.has(r.party_code)) missingParty.add(r.party_code);
    if (!areas.has(r.uo_code)) missingArea.add(r.uo_code);
  }
  if (missingParty.size || missingArea.size) {
    const parts: string[] = [];
    if (missingParty.size) parts.push(`unknown party codes: ${[...missingParty].join(", ")}`);
    if (missingArea.size) parts.push(`unknown area codes: ${[...missingArea].join(", ")}`);
    throw new Error(`[shadow-budget] refusing to run — ${parts.join("; ")}`);
  }
}

function groupByYearParty(rows: CsvRow[]): Map<string, CsvRow[]> {
  const m = new Map<string, CsvRow[]>();
  for (const r of rows) {
    const k = `${r.year}|${r.party_code}`;
    const list = m.get(k);
    if (list) list.push(r); else m.set(k, [r]);
  }
  return m;
}

async function main() {
  console.log("[shadow-budget] starting seeder");
  const rows = await loadAllRows();
  console.log(`[shadow-budget] loaded ${rows.length} CSV rows`);

  const client = await maybeConnect();
  if (!client) {
    console.log("[shadow-budget] DRY mode (no DATABASE_URL). Would:");
    // Offline code sanity: require known dim codes so DRY still catches typos.
    const knownParties = new Set(["GOV", "S", "M", "SD", "C", "V", "KD", "MP", "L", "ALLIANSEN"]);
    const knownAreas = new Set(Array.from({ length: 27 }, (_, i) => `UO${String(i + 1).padStart(2, "0")}`));
    const badP = new Set<string>(); const badA = new Set<string>();
    for (const r of rows) {
      if (!knownParties.has(r.party_code)) badP.add(r.party_code);
      if (!knownAreas.has(r.uo_code)) badA.add(r.uo_code);
    }
    if (badP.size || badA.size) {
      console.error("[shadow-budget] DRY validation failed:");
      if (badP.size) console.error("  unknown parties:", [...badP]);
      if (badA.size) console.error("  unknown areas:", [...badA]);
      process.exit(1);
    }
    const groups = groupByYearParty(rows);
    for (const [k, list] of groups) {
      const [year, party] = k.split("|");
      console.log(`  DELETE shadow_delta WHERE year=${year} party=${party}`);
      console.log(`  INSERT ${list.length} rows for ${party} ${year} (sum ${list.reduce((s, r) => s + r.delta_mkr, 0).toFixed(1)} mkr)`);
    }
    return;
  }

  try {
    const { parties, areas } = await loadDims(client);
    validateCodes(rows, parties, areas);

    const groups = groupByYearParty(rows);
    const report: Array<{ year: number; party: string; deleted: number; inserted: number }> = [];

    for (const [k, list] of groups) {
      const [yearStr, partyCode] = k.split("|");
      const year = Number(yearStr);
      const partyId = parties.get(partyCode)!;
      const del = await client.query(
        `delete from public.fact_budget
          where budget_type = 'shadow_delta'
            and year_id = $1
            and party_id = $2`,
        [year, partyId],
      );
      let inserted = 0;
      for (const r of list) {
        const areaId = areas.get(r.uo_code)!;
        const amountSek = r.delta_mkr * 1_000_000;
        await client.query(
          `insert into public.fact_budget
             (year_id, area_id, anslag_id, party_id, budget_type, amount_nominal_sek, is_revenue)
           values ($1, $2, null, $3, 'shadow_delta', $4, false)`,
          [year, areaId, partyId, amountSek],
        );
        inserted++;
      }
      report.push({ year, party: partyCode, deleted: del.rowCount ?? 0, inserted });
    }

    console.log("[shadow-budget] done");
    console.table(report);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error("[shadow-budget] FAILED:", err);
  process.exit(1);
});
