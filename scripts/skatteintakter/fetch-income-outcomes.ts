import { unlink } from 'node:fs/promises';
import type {
  IncomeOutcomeLevel,
  IncomeOutcomeMonthFact,
  IncomeOutcomeSnapshot,
  IncomeOutcomeTitleDef,
} from './types.ts';

const OPEN_DATA_PAGE_URL = 'https://www.statskontoret.se/psidata/manadsutfall/';

const LEVEL_ORDER: IncomeOutcomeLevel[] = [
  'income_type',
  'income_main_group',
  'income_title_group',
  'income_title',
];

const MONTH_HEADERS = [
  'Utfall januari',
  'Utfall februari',
  'Utfall mars',
  'Utfall april',
  'Utfall maj',
  'Utfall juni',
  'Utfall juli',
  'Utfall augusti',
  'Utfall september',
  'Utfall oktober',
  'Utfall november',
  'Utfall december',
] as const;

type OutcomeSource = {
  source_year: number;
  source_month: number;
  source_status: string;
  source_url: string;
};

type IncomeHierarchyEntry = {
  level_key: IncomeOutcomeLevel;
  code: string;
  name_sv: string;
  parent_code: string | null;
};

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      const nextChar = line[i + 1];
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      tokens.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  tokens.push(current);
  return tokens;
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase();
}

function normalizeCode(value: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  return cleaned;
}

function parseAmount(value: string): number | null {
  const cleaned = value
    .replace(/\u00a0/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.')
    .trim();
  if (!cleaned) return null;
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

async function getLatestIncomeOutcomeSource(): Promise<OutcomeSource> {
  const res = await fetch(OPEN_DATA_PAGE_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch monthly outcome page: ${res.status}`);
  }

  const html = await res.text();
  const candidates = [...html.matchAll(
    /href="([^"]*OpenDataManadsUtfallPage\/GetFile\?[^"]*documentType=Inkomst[^"]*fileType=Zip[^"]*Year=(\d+)&month=(\d+)&status=([^"&]+)[^"]*)"/g,
  )].map((match) => ({
    href: match[1].replace(/&amp;/g, '&'),
    year: Number.parseInt(match[2], 10),
    month: Number.parseInt(match[3], 10),
    status: decodeURIComponent(match[4]),
  }));

  if (candidates.length === 0) {
    throw new Error('No monthly income outcome download links found on open data page.');
  }

  candidates.sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    return right.month - left.month;
  });

  const latest = candidates[0];
  return {
    source_year: latest.year,
    source_month: latest.month,
    source_status: latest.status,
    source_url: new URL(latest.href, OPEN_DATA_PAGE_URL).toString(),
  };
}

async function downloadCsvText(sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch monthly income outcome ZIP: ${res.status}`);
  }

  const tmpZip = `/tmp/statsbudget-income-outcomes-${Date.now()}.zip`;
  await Bun.write(tmpZip, new Uint8Array(await res.arrayBuffer()));

  try {
    const proc = Bun.spawn(['unzip', '-p', tmpZip], { stdout: 'pipe', stderr: 'pipe' });
    const csvText = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`Failed to unzip monthly income outcomes: ${stderr.trim() || `exit ${exitCode}`}`);
    }
    return csvText;
  } finally {
    await unlink(tmpZip).catch(() => undefined);
  }
}

function buildHierarchyEntries(record: Record<string, string>): IncomeHierarchyEntry[] {
  const typeCode = normalizeCode(record['Inkomsttyp'] ?? '');
  const mainGroupCode = normalizeCode(record['Inkomsthuvudgrupp'] ?? '');
  const titleGroupCode = normalizeCode(record['Inkomsttitelgrupp'] ?? '');
  const titleCode = normalizeCode(record['Inkomsttitel'] ?? '');

  const entries: IncomeHierarchyEntry[] = [];

  if (typeCode) {
    entries.push({
      level_key: 'income_type',
      code: typeCode,
      name_sv: record['Inkomsttypsnamn']?.trim() ?? typeCode,
      parent_code: null,
    });
  }

  if (mainGroupCode) {
    entries.push({
      level_key: 'income_main_group',
      code: mainGroupCode,
      name_sv: record['Inkomsthuvudgruppsnamn']?.trim() ?? mainGroupCode,
      parent_code: typeCode,
    });
  }

  if (titleGroupCode) {
    entries.push({
      level_key: 'income_title_group',
      code: titleGroupCode,
      name_sv: record['Inkomsttitelgruppsnamn']?.trim() ?? titleGroupCode,
      parent_code: mainGroupCode ?? typeCode,
    });
  }

  if (titleCode) {
    entries.push({
      level_key: 'income_title',
      code: titleCode,
      name_sv: record['Inkomsttitelsnamn']?.trim() ?? titleCode,
      parent_code: titleGroupCode ?? mainGroupCode ?? typeCode,
    });
  }

  return entries;
}

export async function fetchIncomeOutcomeSnapshot(): Promise<IncomeOutcomeSnapshot> {
  const source = await getLatestIncomeOutcomeSource();
  const csvText = await downloadCsvText(source.source_url);
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('Monthly income outcome CSV was empty.');
  }

  const header = parseDelimitedLine(lines[0], ';').map((column) => column.replace(/^\uFEFF/, '').trim());
  const headerLookup = new Map(header.map((column, index) => [normalizeHeader(column), index]));

  const requiredColumns = [
    'Inkomsttyp',
    'Inkomsttypsnamn',
    'Inkomsthuvudgrupp',
    'Inkomsthuvudgruppsnamn',
    'Inkomsttitelgrupp',
    'Inkomsttitelgruppsnamn',
    'Inkomsttitel',
    'Inkomsttitelsnamn',
    'År',
    ...MONTH_HEADERS,
  ];

  for (const requiredColumn of requiredColumns) {
    if (!headerLookup.has(normalizeHeader(requiredColumn))) {
      throw new Error(`Monthly income outcome CSV is missing column: ${requiredColumn}`);
    }
  }

  const defsByCode = new Map<string, IncomeHierarchyEntry>();
  const factsByKey = new Map<string, number>();

  for (const line of lines.slice(1)) {
    const values = parseDelimitedLine(line, ';');
    if (values.length !== header.length) {
      throw new Error(
        `Monthly income outcome CSV row has ${values.length} fields; expected ${header.length}. ` +
        `Row starts with: ${line.slice(0, 200)}`,
      );
    }

    const record: Record<string, string> = {};
    for (let index = 0; index < header.length; index++) {
      record[header[index]] = values[index]?.trim() ?? '';
    }

    const year = Number.parseInt(record['År'], 10);
    if (!Number.isFinite(year)) continue;

    const hierarchyEntries = buildHierarchyEntries(record);
    if (hierarchyEntries.length === 0) continue;

    for (const entry of hierarchyEntries) {
      if (!defsByCode.has(entry.code)) {
        defsByCode.set(entry.code, entry);
      }
    }

    for (let monthIndex = 0; monthIndex < MONTH_HEADERS.length; monthIndex++) {
      const amount = parseAmount(record[MONTH_HEADERS[monthIndex]] ?? '');
      if (amount == null) continue;

      const seenCodes = new Set<string>();
      for (const entry of hierarchyEntries) {
        if (seenCodes.has(entry.code)) continue;
        seenCodes.add(entry.code);

        const key = `${year}|${monthIndex + 1}|${entry.code}`;
        factsByKey.set(key, (factsByKey.get(key) ?? 0) + amount);
      }
    }
  }

  const titles = [...defsByCode.values()]
    .sort((left, right) => {
      const levelDelta = LEVEL_ORDER.indexOf(left.level_key) - LEVEL_ORDER.indexOf(right.level_key);
      if (levelDelta !== 0) return levelDelta;
      return left.code.localeCompare(right.code, 'sv', { numeric: true });
    })
    .map<IncomeOutcomeTitleDef>((entry, index) => ({
      code: entry.code,
      parent_code: entry.parent_code,
      level_key: entry.level_key,
      name_sv: entry.name_sv,
      sort_order: index + 1,
    }));

  const facts = [...factsByKey.entries()]
    .map<IncomeOutcomeMonthFact>(([key, amount_mkr]) => {
      const [year, month, code] = key.split('|');
      return {
        year: Number(year),
        month: Number(month),
        code,
        amount_mkr,
        source_year: source.source_year,
        source_month: source.source_month,
        source_status: source.source_status,
      };
    })
    .sort((left, right) =>
      left.year - right.year
      || left.month - right.month
      || left.code.localeCompare(right.code, 'sv', { numeric: true }),
    );

  return {
    titles,
    facts,
    source_year: source.source_year,
    source_month: source.source_month,
    source_status: source.source_status,
    source_url: source.source_url,
  };
}
