#!/usr/bin/env bun
/**
 * Statsbudget ETL seeder.
 *
 * Sources:
 *   - ESV utfall 1997-2025 (semicolon CSV, Mkr)
 *     https://www.statskontoret.se/psidata/arsutfall/
 *   - SCB TAB4352 — KPI fastställda årsmedel (1980=100), 1980-2025
 *   - SCB TAB4553 — BNP till marknadspris, löpande priser, kvartal 1981K1-
 *
 * Usage:
 *   DATABASE_URL=postgres://... bun scripts/seed.ts
 *
 * Monetary values stored as Mkr (millions SEK) in bigint columns.
 * Idempotent: refreshes shared dimensions with upserts and reseeds budget facts.
 * dim_party comes from the migration.
 */

import { SQL } from 'bun';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Grab it from Supabase dashboard → Project Settings → Database → Connection string (URI).');
  process.exit(1);
}

// URL-encode the password segment if the user pasted it raw.
// postgres://user:PASSWORD@host:port/db — encode everything between first ':' after scheme and last '@'.
function normalizePgUrl(raw: string): string {
  const m = /^(postgres(?:ql)?:\/\/)([^@\s]+)@(.+)$/s.exec(raw);
  if (!m) return raw;
  const [, scheme, userinfo, rest] = m;
  const colon = userinfo.indexOf(':');
  if (colon < 0) return raw;
  const user = userinfo.slice(0, colon);
  const pwd = userinfo.slice(colon + 1);
  // If pwd already looks encoded (no special chars), leave it; else encode.
  const needsEncode = /[^A-Za-z0-9\-._~]/.test(pwd) && !/%[0-9A-Fa-f]{2}/.test(pwd);
  const encPwd = needsEncode ? encodeURIComponent(pwd) : pwd;
  return `${scheme}${user}:${encPwd}@${rest}`;
}

const normalized = normalizePgUrl(DATABASE_URL);
// Ensure SSL is on (Supabase requires it)
const withSsl = normalized.includes('sslmode=') ? normalized : normalized + (normalized.includes('?') ? '&' : '?') + 'sslmode=require';
// Log masked URL (hide password + user)
try {
  const u = new URL(withSsl);
  console.log(`DB: ${u.protocol}//***@${u.hostname}:${u.port}${u.pathname}${u.search}`);
} catch {
  console.log('DB: [masked connection string unavailable]');
}
const sql = new SQL(withSsl);
type SqlExecutor = Pick<SQL, 'unsafe'>;

const YEAR_MIN = 1997;
const HISTORICAL_YEARS = [1975, 1980, 1985, 1990, 1995];
const GOV_PARTY_ID = 1;

// ---------- ESV ----------

type EsvRow = {
  uo: number;
  uoName: string;
  anslagIdNum: number | null;
  anslagCode: string | null;
  anslagName: string;
  year: number;
  utfall: number;
};

type RiksdagenListResponse = {
  dokumentlista?: {
    dokument?: RiksdagenDoc | RiksdagenDoc[] | null;
  };
};

type RiksdagenDoc = {
  dok_id: string;
  titel: string;
  datum?: string;
  dokument_url_html?: string | null;
  sokdata?: {
    statusrad?: string;
  };
};

type RiksdagenBudgetMetadata = {
  propositionUrl: string | null;
  propositionTitle: string | null;
  decisionUrl: string | null;
  decisionTitle: string | null;
};

async function fetchEsv(): Promise<EsvRow[]> {
  const url = 'https://www.statskontoret.se/OpenDataArsUtfallPage/GetFile?documentType=Utgift&fileType=Zip&fileName=%C3%85rsutfall%20utgifter%201997%20-%202025,%20definitivt.zip&Year=2025&month=0&status=Definitiv';
  console.log('→ ESV utfall zip');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESV fetch failed: ${res.status}`);
  const zipBuf = new Uint8Array(await res.arrayBuffer());

  // Write to tmp then `unzip -p` — avoids Swedish filename extraction problems.
  const tmpZip = `/tmp/statsbudget-esv-${Date.now()}.zip`;
  await Bun.write(tmpZip, zipBuf);
  const proc = Bun.spawn(['unzip', '-p', tmpZip], { stdout: 'pipe', stderr: 'pipe' });
  const csvText = await new Response(proc.stdout).text();
  await proc.exited;

  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const rows: EsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(';');
    const uoStr = c[0];
    if (!uoStr || !/^\d{1,2}$/.test(uoStr)) continue;
    const uo = parseInt(uoStr, 10);
    if (uo < 1 || uo > 27) continue;
    const year = parseInt(c[4], 10);
    if (!Number.isFinite(year) || year < YEAR_MIN) continue;
    const utfall = parseFloat(c[10].replace(',', '.'));
    if (!Number.isFinite(utfall)) continue;

    let anslagIdNum: number | null = null;
    let anslagCode: string | null = null;
    if (c[2] && /^\d+$/.test(c[2])) {
      anslagIdNum = parseInt(c[2], 10);
      const s = c[2].padStart(7, '0');
      const major = parseInt(s.slice(2, 4), 10);
      const minor = parseInt(s.slice(4), 10);
      anslagCode = `${major}:${minor}`;
    }
    rows.push({ uo, uoName: c[1], anslagIdNum, anslagCode, anslagName: c[3], year, utfall });
  }
  console.log(`  ${rows.length} ESV rows`);
  return rows;
}

function formatRiksmoteForBudgetYear(year: number): string {
  const start = year - 1;
  const end = year;
  return Math.floor(start / 100) === Math.floor(end / 100)
    ? `${start}/${String(end).slice(-2)}`
    : `${start}/${end}`;
}

function normalizeSwedishText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteRiksdagenUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://data.riksdagen.se${url.startsWith('/') ? '' : '/'}${url}`;
}

function buildRiksdagenDocUrl(docId: string): string {
  return `https://data.riksdagen.se/dokument/${encodeURIComponent(docId)}.html`;
}

async function fetchRiksdagenDocs(params: Record<string, string>): Promise<RiksdagenDoc[]> {
  const url = new URL('https://data.riksdagen.se/dokumentlista/');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('utformat', 'json');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Riksdagen fetch failed: ${res.status}`);

  const parsed = (await res.json()) as RiksdagenListResponse;
  const docs = parsed.dokumentlista?.dokument;
  if (!docs) return [];
  return Array.isArray(docs) ? docs : [docs];
}

function scoreRiksdagenBudgetProposition(doc: RiksdagenDoc, year: number): number {
  const title = normalizeSwedishText(doc.titel);
  let score = 0;

  if (title.includes(`budgetpropositionen for ${year}`)) score += 140;
  if (title.includes(`forslag till statsbudget for budgetaret ${year}`)) score += 130;
  if (title.includes(`statsbudget for budgetaret ${year}`)) score += 110;
  if (title.includes(`statens budget ${year}`)) score += 90;
  if (title.includes('budgetpropositionen')) score += 30;
  if (title.includes('statsbudget')) score += 20;
  if (title.includes(String(year))) score += 10;

  return score;
}

function extractBetankandeAnchors(statusrad: string | undefined): { title: string; docId: string }[] {
  if (!statusrad) return [];
  const anchors: { title: string; docId: string }[] = [];
  const anchorRegex = /<a\b([^>]+)>/g;
  for (let match = anchorRegex.exec(statusrad); match; match = anchorRegex.exec(statusrad)) {
    const attrs = match[1];
    if (!/data-dokumentnamn="Betänkande"/.test(attrs)) continue;
    const titleMatch = /data-dokumenttitel="([^"]+)"/.exec(attrs);
    const idMatch = /data-dokumentid="([^"]+)"/.exec(attrs);
    if (!titleMatch || !idMatch) continue;
    anchors.push({ title: titleMatch[1], docId: idMatch[1] });
  }
  return anchors;
}

function scoreRiksdagenDecision(anchor: { title: string; docId: string }, year: number): number {
  const title = normalizeSwedishText(anchor.title);
  let score = 0;

  if (/fiu/i.test(anchor.docId)) score += 40;
  if (title.includes(`statsbudgetens utgifter for budgetaret ${year}`)) score += 140;
  if (title.includes(`statsbudget for budgetaret ${year}`)) score += 140;
  if (title.includes(`statens budget ${year}`)) score += 130;
  if (title.includes('utgiftsramar')) score += 110;
  if (title.includes('statsinkomsterna')) score += 90;
  if (title.includes('budget')) score += 30;
  if (title.includes(String(year))) score += 10;

  return score;
}

function pickRiksdagenDecision(statusrad: string | undefined, year: number) {
  const candidates = extractBetankandeAnchors(statusrad)
    .map((anchor) => ({ ...anchor, score: scoreRiksdagenDecision(anchor, year) }))
    .filter((anchor) => anchor.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'sv'));

  return candidates[0] ?? null;
}

async function fetchRiksdagenBudgetMetadata(year: number): Promise<RiksdagenBudgetMetadata> {
  const rm = formatRiksmoteForBudgetYear(year);
  const searchTerms = [
    `budgetpropositionen för ${year}`,
    `förslag till statsbudget för budgetåret ${year}`,
    `statsbudget för budgetåret ${year}`,
    `statens budget ${year}`,
  ];

  const candidates = new Map<string, RiksdagenDoc>();
  for (const searchTerm of searchTerms) {
    const docs = await fetchRiksdagenDocs({
      doktyp: 'prop',
      rm,
      sok: searchTerm,
      sort: 'datum',
      sortorder: 'desc',
    });
    for (const doc of docs) candidates.set(doc.dok_id, doc);
  }

  const proposition = [...candidates.values()]
    .map((doc) => ({ doc, score: scoreRiksdagenBudgetProposition(doc, year) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.doc.datum ?? '').localeCompare(a.doc.datum ?? '');
    })[0]?.doc;

  if (!proposition) {
    throw new Error(`Could not find Riksdagen budget proposition for ${year} (${rm})`);
  }

  const decision = pickRiksdagenDecision(proposition.sokdata?.statusrad, year);

  return {
    propositionUrl: absoluteRiksdagenUrl(proposition.dokument_url_html) ?? buildRiksdagenDocUrl(proposition.dok_id),
    propositionTitle: proposition.titel,
    decisionUrl: decision ? buildRiksdagenDocUrl(decision.docId) : null,
    decisionTitle: decision?.title ?? null,
  };
}

async function fetchRiksdagenBudgetMetadataMap(years: number[]): Promise<Map<number, RiksdagenBudgetMetadata>> {
  const out = new Map<number, RiksdagenBudgetMetadata>();
  for (const year of years) {
    console.log(`→ Riksdagen metadata ${year}`);
    out.set(year, await fetchRiksdagenBudgetMetadata(year));
  }
  return out;
}

// ---------- SCB ----------

type JsonStat2 = {
  dimension: Record<string, { category: { index: Record<string, number>; label: Record<string, string> } }>;
  value: (number | null)[];
};

type EurostatJson = {
  id: string[];
  size: number[];
  dimension: {
    cofog99: { category: { index: Record<string, number>; label: Record<string, string> } };
    time: { category: { index: Record<string, number>; label: Record<string, string> } };
  };
  value: Record<string, number>;
};

const PUBLIC_BUDGET_FUNCTIONS = [
  { public_function_id: 1, code: 'GF01', name_sv: 'Allmän offentlig förvaltning', name_en: 'General public services' },
  { public_function_id: 2, code: 'GF02', name_sv: 'Försvar', name_en: 'Defence' },
  { public_function_id: 3, code: 'GF03', name_sv: 'Allmän ordning och säkerhet', name_en: 'Public order and safety' },
  { public_function_id: 4, code: 'GF04', name_sv: 'Näringslivsfrågor', name_en: 'Economic affairs' },
  { public_function_id: 5, code: 'GF05', name_sv: 'Miljöskydd', name_en: 'Environmental protection' },
  { public_function_id: 6, code: 'GF06', name_sv: 'Bostäder och samhällsutveckling', name_en: 'Housing and community amenities' },
  { public_function_id: 7, code: 'GF07', name_sv: 'Hälso- och sjukvård', name_en: 'Health' },
  { public_function_id: 8, code: 'GF08', name_sv: 'Fritid, kultur och religion', name_en: 'Recreation, culture and religion' },
  { public_function_id: 9, code: 'GF09', name_sv: 'Utbildning', name_en: 'Education' },
  { public_function_id: 10, code: 'GF10', name_sv: 'Socialt skydd', name_en: 'Social protection' },
] as const;

const PUBLIC_BUDGET_SUBSECTORS = [
  { public_subsector_id: 1, code: 'S1311', name_sv: 'Staten', name_en: 'Central government' },
  { public_subsector_id: 2, code: 'S1313', name_sv: 'Kommuner och regioner', name_en: 'Local government' },
  { public_subsector_id: 3, code: 'S1314', name_sv: 'Socialförsäkringar', name_en: 'Social security funds' },
] as const;

async function scb(tableId: string, valueCodes: Record<string, string[]> = {}): Promise<JsonStat2> {
  const base = `https://api.scb.se/OV0104/v2beta/api/v2/tables/${tableId}/data`;
  const p = new URLSearchParams({ lang: 'sv', outputFormat: 'json-stat2' });
  for (const [k, vs] of Object.entries(valueCodes)) p.append(`valueCodes[${k}]`, vs.join(','));
  console.log(`→ SCB ${tableId}`);
  const res = await fetch(`${base}?${p}`);
  if (!res.ok) throw new Error(`SCB ${tableId}: ${res.status} ${await res.text()}`);
  return res.json();
}

function tidKey(js: JsonStat2): string {
  return Object.keys(js.dimension).find((k) => k.toLowerCase() === 'tid') ?? 'Tid';
}

async function fetchCpi(): Promise<Map<number, number>> {
  const js = await scb('TAB4352', { ContentsCode: ['000000KL'], Tid: ['*'] });
  const dim = js.dimension[tidKey(js)];
  const out = new Map<number, number>();
  for (const [code, idx] of Object.entries(dim.category.index)) {
    const v = js.value[idx];
    if (typeof v !== 'number') continue;
    const y = parseInt(code, 10);
    if (Number.isFinite(y)) out.set(y, v);
  }
  console.log(`  CPI years: ${out.size}`);
  return out;
}

async function fetchBnp(): Promise<Map<number, number>> {
  const js = await scb('TAB4553', { Anvandningstyp: ['BNPM'], ContentsCode: ['NR0103CG'], Tid: ['*'] });
  const dim = js.dimension[tidKey(js)];
  const out = new Map<number, number>();
  for (const [code, idx] of Object.entries(dim.category.index)) {
    const v = js.value[idx];
    if (typeof v !== 'number') continue;
    const m = /^(\d{4})K\d$/.exec(code);
    if (!m) continue;
    const y = parseInt(m[1], 10);
    out.set(y, (out.get(y) ?? 0) + v);
  }
  // Drop incomplete trailing year if < 4 quarters were summed
  // (2025 has Q1-Q4; ok. keep a guard anyway)
  console.log(`  BNP years: ${out.size}`);
  return out;
}

async function fetchEurostatPublicBudgetBySector(sectorCode: string) {
  const url = new URL('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp');
  url.searchParams.set('format', 'JSON');
  url.searchParams.set('lang', 'EN'); // Eurostat data API only accepts EN, FR, or DE — not SV
  url.searchParams.set('geo', 'SE');
  url.searchParams.set('sector', sectorCode);
  url.searchParams.set('na_item', 'TE');
  url.searchParams.set('unit', 'MIO_NAC');
  for (const fn of PUBLIC_BUDGET_FUNCTIONS) {
    url.searchParams.append('cofog99', fn.code);
  }

  console.log(`→ Eurostat gov_10a_exp ${sectorCode}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Eurostat gov_10a_exp ${sectorCode} failed: ${res.status}`);
  const json = await res.json() as EurostatJson;

  const cofogIndex = json.dimension.cofog99?.category.index;
  const timeIndex = json.dimension.time?.category.index;
  if (!cofogIndex || !timeIndex) {
    throw new Error('Eurostat gov_10a_exp response missing cofog99/time dimensions');
  }

  const years = Object.keys(timeIndex)
    .map((year) => parseInt(year, 10))
    .filter((year) => Number.isFinite(year))
    .sort((a, b) => a - b);
  const yearCount = years.length;
  const facts: [number, number, number][] = [];

  for (const fn of PUBLIC_BUDGET_FUNCTIONS) {
    const cofogPos = cofogIndex[fn.code];
    if (!Number.isFinite(cofogPos)) {
      throw new Error(`Eurostat gov_10a_exp missing COFOG code ${fn.code}`);
    }
    for (const [yearCode, yearPos] of Object.entries(timeIndex)) {
      const year = parseInt(yearCode, 10);
      if (!Number.isFinite(year)) continue;
      const raw = json.value[String(cofogPos * yearCount + yearPos)];
      if (typeof raw !== 'number') continue;
      facts.push([year, fn.public_function_id, Math.round(raw)]);
    }
  }

  return { years, facts };
}

async function fetchEurostatPublicBudget() {
  const result = await fetchEurostatPublicBudgetBySector('S13');
  console.log(`  Eurostat years: ${result.years.length}`);
  return { years: result.years, functions: PUBLIC_BUDGET_FUNCTIONS, facts: result.facts };
}

async function fetchEurostatPublicSubsectorBudget() {
  const sectorResults = await Promise.all(
    PUBLIC_BUDGET_SUBSECTORS.map(async (subsector) => ({
      subsector,
      data: await fetchEurostatPublicBudgetBySector(subsector.code),
    })),
  );

  const yearSet = new Set<number>();
  const facts: [number, number, number, number][] = [];

  for (const { subsector, data } of sectorResults) {
    for (const year of data.years) yearSet.add(year);
    for (const [year, publicFunctionId, amount] of data.facts) {
      facts.push([year, subsector.public_subsector_id, publicFunctionId, amount]);
    }
  }

  const years = [...yearSet].sort((a, b) => a - b);
  console.log(`  Eurostat subsector years: ${years.length}`);
  return { years, subsectors: PUBLIC_BUDGET_SUBSECTORS, facts };
}

// ---------- Load ----------

async function main() {
  console.log('== Statsbudget seed ==');

  for (const migrationPath of [
     '../supabase/migrations/20260411120000_star_schema.sql',
     '../supabase/migrations/20260411213000_riksdagen_metadata.sql',
     '../supabase/migrations/20260413120000_public_budget.sql',
     '../supabase/migrations/20260414104000_public_subsectors.sql',
    ]) {
    const migrationSql = await Bun.file(new URL(migrationPath, import.meta.url)).text();
    console.log(`→ applying migration ${migrationPath.split('/').pop()}`);
    await sql.unsafe(migrationSql);
  }

  const [esvRows, publicBudget, publicSubsectorBudget, cpi, bnp] = await Promise.all([
    fetchEsv(),
    fetchEurostatPublicBudget(),
    fetchEurostatPublicSubsectorBudget(),
    fetchCpi(),
    fetchBnp(),
  ]);
  const budgetYears = [...new Set(esvRows.map((r) => r.year))].sort((a, b) => a - b);
  const riksdagenBudgetMeta = await fetchRiksdagenBudgetMetadataMap(budgetYears);

  const areaMap = new Map<number, string>();
  for (const r of esvRows) if (!areaMap.has(r.uo)) areaMap.set(r.uo, r.uoName);
  const areas = [...areaMap.entries()].sort((a, b) => a[0] - b[0]);

  const yearSet = new Set<number>();
  for (const r of esvRows) yearSet.add(r.year);
  for (const y of publicBudget.years) yearSet.add(y);
  for (const y of publicSubsectorBudget.years) yearSet.add(y);
  for (const y of cpi.keys()) yearSet.add(y);
  for (const y of bnp.keys()) yearSet.add(y);
  for (const y of HISTORICAL_YEARS) yearSet.add(y);
  const years = [...yearSet].sort((a, b) => a - b);

  const anslagMap = new Map<number, { area_id: number; code: string; name_sv: string }>();
  for (const r of esvRows) {
    if (r.anslagIdNum == null || r.anslagCode == null) continue;
    if (!anslagMap.has(r.anslagIdNum)) {
      anslagMap.set(r.anslagIdNum, { area_id: r.uo, code: r.anslagCode, name_sv: r.anslagName });
    }
  }

  const areaTotals = new Map<string, number>();
  for (const r of esvRows) {
    const k = `${r.year}|${r.uo}`;
    areaTotals.set(k, (areaTotals.get(k) ?? 0) + r.utfall);
  }

  console.log(`  dim_area: ${areas.length}`);
  console.log(`  dim_public_function: ${publicBudget.functions.length}`);
  console.log(`  dim_public_subsector: ${publicSubsectorBudget.subsectors.length}`);
  console.log(`  dim_year: ${years.length} (${years[0]}-${years[years.length - 1]})`);
  console.log(`  dim_anslag: ${anslagMap.size}`);
  console.log(`  fact rows: ${areaTotals.size} area + ${esvRows.filter((r) => r.anslagIdNum != null).length} anslag`);
  console.log(`  fact_public_budget: ${publicBudget.facts.length}`);
  console.log(`  fact_public_subsector_budget: ${publicSubsectorBudget.facts.length}`);

  await sql.begin(async (tx: SqlExecutor) => {
    await tx.unsafe('truncate public.fact_public_subsector_budget restart identity cascade');
    await tx.unsafe('truncate public.fact_public_budget restart identity cascade');
    await tx.unsafe('truncate public.fact_budget restart identity cascade');
    await tx.unsafe('delete from public.dim_public_subsector');
    await tx.unsafe('delete from public.dim_public_function');
    await tx.unsafe('delete from public.dim_anslag');

    for (const [uo, name] of areas) {
      const code = `UO${uo.toString().padStart(2, '0')}`;
      await tx.unsafe(
        `insert into public.dim_area(area_id, code, name_sv, name_en, sort_order)
         values ($1,$2,$3,null,$4)
         on conflict (area_id) do update set
           code = excluded.code,
           name_sv = excluded.name_sv,
           name_en = excluded.name_en,
           sort_order = excluded.sort_order`,
        [uo, code, name, uo],
      );
    }

    for (const y of years) {
      const cpiVal = cpi.get(y) ?? null;
      const bnpVal = bnp.get(y);
      const bnpInt = bnpVal != null ? Math.round(bnpVal) : null;
      const hist = HISTORICAL_YEARS.includes(y);
      const budgetMeta = riksdagenBudgetMeta.get(y);
      await tx.unsafe(
        `insert into public.dim_year(
           year_id,
           cpi_index,
           gdp_nominal_sek,
           is_historical,
           riksdagen_proposition_url,
           riksdagen_proposition_title,
           riksdagen_decision_url,
           riksdagen_decision_title
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (year_id) do update set
           cpi_index = excluded.cpi_index,
           gdp_nominal_sek = excluded.gdp_nominal_sek,
           is_historical = excluded.is_historical,
           riksdagen_proposition_url = excluded.riksdagen_proposition_url,
           riksdagen_proposition_title = excluded.riksdagen_proposition_title,
           riksdagen_decision_url = excluded.riksdagen_decision_url,
           riksdagen_decision_title = excluded.riksdagen_decision_title`,
        [
          y,
          cpiVal,
          bnpInt,
          hist,
          budgetMeta?.propositionUrl ?? null,
          budgetMeta?.propositionTitle ?? null,
          budgetMeta?.decisionUrl ?? null,
          budgetMeta?.decisionTitle ?? null,
        ],
      );
    }

    for (const fn of publicBudget.functions) {
      await tx.unsafe(
        'insert into public.dim_public_function(public_function_id, code, name_sv, name_en, sort_order) values ($1,$2,$3,$4,$5)',
        [fn.public_function_id, fn.code, fn.name_sv, fn.name_en, fn.public_function_id],
      );
    }

    for (const subsector of publicSubsectorBudget.subsectors) {
      await tx.unsafe(
        'insert into public.dim_public_subsector(public_subsector_id, code, name_sv, name_en, sort_order) values ($1,$2,$3,$4,$5)',
        [
          subsector.public_subsector_id,
          subsector.code,
          subsector.name_sv,
          subsector.name_en,
          subsector.public_subsector_id,
        ],
      );
    }

    for (const [id, a] of anslagMap) {
      await tx.unsafe(
        'insert into public.dim_anslag(anslag_id, area_id, code, name_sv, name_en) values ($1,$2,$3,$4,null)',
        [id, a.area_id, a.code, a.name_sv],
      );
    }

    // Bulk area rows via multi-row VALUES
    const areaFacts = [...areaTotals.entries()].map(([k, total]) => {
      const [y, a] = k.split('|').map(Number);
      return [y, a, Math.round(total)] as [number, number, number];
    });
    await bulkInsertAreaFacts(tx, areaFacts);

    const anslagFacts = esvRows
      .filter((r) => r.anslagIdNum != null)
      .map((r) => [r.year, r.uo, r.anslagIdNum!, Math.round(r.utfall)] as [number, number, number, number]);
    await bulkInsertAnslagFacts(tx, anslagFacts);

    await bulkInsertPublicBudgetFacts(tx, publicBudget.facts);
    await bulkInsertPublicSubsectorBudgetFacts(tx, publicSubsectorBudget.facts);
  });

  await sql.end();
  console.log('== Done ==');
}

async function bulkInsertAreaFacts(tx: SqlExecutor, rows: [number, number, number][]) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params: number[] = [];
    const valuesSql = slice.map((r, j) => {
      const off = j * 3;
      params.push(r[0], r[1], r[2]);
      return `($${off + 1},$${off + 2},null,${GOV_PARTY_ID},'actual',$${off + 3},false)`;
    }).join(',');
    await tx.unsafe(
      `insert into public.fact_budget(year_id,area_id,anslag_id,party_id,budget_type,amount_nominal_sek,is_revenue) values ${valuesSql}`,
      params,
    );
  }
}

async function bulkInsertAnslagFacts(tx: SqlExecutor, rows: [number, number, number, number][]) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params: number[] = [];
    const valuesSql = slice.map((r, j) => {
      const off = j * 4;
      params.push(r[0], r[1], r[2], r[3]);
      return `($${off + 1},$${off + 2},$${off + 3},${GOV_PARTY_ID},'actual',$${off + 4},false)`;
    }).join(',');
    await tx.unsafe(
      `insert into public.fact_budget(year_id,area_id,anslag_id,party_id,budget_type,amount_nominal_sek,is_revenue) values ${valuesSql}`,
      params,
    );
  }
}

async function bulkInsertPublicBudgetFacts(tx: SqlExecutor, rows: [number, number, number][]) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params: number[] = [];
    const valuesSql = slice.map((r, j) => {
      const off = j * 3;
      params.push(r[0], r[1], r[2]);
      return `($${off + 1},$${off + 2},$${off + 3})`;
    }).join(',');
    await tx.unsafe(
      `insert into public.fact_public_budget(year_id, public_function_id, amount_mkr) values ${valuesSql}`,
      params,
    );
  }
}

async function bulkInsertPublicSubsectorBudgetFacts(tx: SqlExecutor, rows: [number, number, number, number][]) {
  const chunk = 500;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const params: number[] = [];
    const valuesSql = slice.map((r, j) => {
      const off = j * 4;
      params.push(r[0], r[1], r[2], r[3]);
      return `($${off + 1},$${off + 2},$${off + 3},$${off + 4})`;
    }).join(',');
    await tx.unsafe(
      `insert into public.fact_public_subsector_budget(year_id, public_subsector_id, public_function_id, amount_mkr) values ${valuesSql}`,
      params,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
