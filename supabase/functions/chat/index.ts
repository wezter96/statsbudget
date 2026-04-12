// Statsbudget AI chat edge function.
//
// Runtime: Deno (Supabase Edge Functions).
//
// Data access choice:
//   We use the Supabase service-role client (PostgREST) rather than a raw
//   Postgres driver. Rationale: the function already runs inside the same
//   Supabase project, so PostgREST is the shortest path and avoids bundling
//   a pg driver for Deno. If we later need complex joins or window
//   functions we should switch to a Postgres driver and `DATABASE_URL`
//   (same pattern as scripts/seed.ts).
//
// LLM: provider chosen by CHAT_MODEL via the registry in providers.ts.
//   - anthropic (default): native Messages API with tool_use SSE.
//   - nvidia: NVIDIA NIM free endpoints, OpenAI-compatible chat.completions
//     streaming. The NIM adapter in providers.ts translates Anthropic
//     canonical shape ↔ OpenAI so the handler loop stays unchanged.
//
// Streaming: TRUE token-level streaming. For anthropic we parse
// `text_delta` events token-by-token and accumulate tool_use from
// `input_json_delta`. For nvidia we parse OpenAI `delta.content` and
// accumulate `delta.tool_calls` by index. Both paths emit the same
// canonical SSE protocol to the browser:
//   event: text / event: tool_use / event: tool_result / event: done.
//
// Rate limit: per-IP in-memory cooldown. Trivially bypassed and resets on
// function cold-start. For production, swap to Deno KV or a Postgres table
// keyed by IP + minute bucket. NIM free tier has tight per-minute limits,
// so keeping this cooldown matters more there.
//
// Secrets expected in the Supabase project (at least one provider required):
//   - NVIDIA_API_KEY / NVIDIA_API_KEYS  (comma-separated pool, rotated)
//   - GROQ_API_KEY   / GROQ_API_KEYS    (comma-separated pool, rotated)
//   - ANTHROPIC_API_KEY                 (optional passthrough)
//   - CHAT_MODEL                        (optional; default server-side model)
//   - SUPABASE_URL                      (auto)
//   - SUPABASE_SERVICE_ROLE_KEY         (auto)
//
// Per-request override: the POST body may include a `model` field to
// pick any model from the registry (see providers.ts). Unknown ids fall
// back to CHAT_MODEL. The required key pool is checked per resolved
// provider, so you can run with only NVIDIA or only Groq keys set.

// @ts-ignore - Deno remote imports resolved at runtime by Supabase.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  hasProviderKeys,
  loadKeys,
  resolveModel,
  streamOpenAICompat,
  type AnthropicContentBlock,
  type AnthropicMessage,
  type AnthropicToolResultBlock,
  type AnthropicToolUseBlock,
  type ModelInfo,
  type StreamResult,
} from './providers.ts';

// ----- types ---------------------------------------------------------------

interface ChatRequestBody {
  messages: AnthropicMessage[];
  lang?: 'sv' | 'en';
  /** Optional per-request model override (must be a registry id). */
  model?: string;
}

// ----- constants -----------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Default to a free Groq model. Tool-capable, fast, and the key is free
// to obtain. Override via CHAT_MODEL env or per-request `model` field.
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const MAX_TOOL_ITERATIONS = 5;
const RATE_LIMIT_MS = 15_000;

// ----- rate limiting -------------------------------------------------------

const lastHitByIp = new Map<string, number>();

function checkRateLimit(ip: string): number | null {
  const now = Date.now();
  const last = lastHitByIp.get(ip) ?? 0;
  const diff = now - last;
  if (diff < RATE_LIMIT_MS) {
    return Math.ceil((RATE_LIMIT_MS - diff) / 1000);
  }
  lastHitByIp.set(ip, now);
  // Keep the map small-ish: drop entries older than 10 minutes.
  if (lastHitByIp.size > 500) {
    const cutoff = now - 10 * 60 * 1000;
    for (const [k, v] of lastHitByIp) if (v < cutoff) lastHitByIp.delete(k);
  }
  return null;
}

// ----- supabase client -----------------------------------------------------

// @ts-ignore - Deno global available in edge runtime.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// @ts-ignore
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
// @ts-ignore
const NVIDIA_API_KEY = Deno.env.get('NVIDIA_API_KEY') ?? '';
// @ts-ignore
const NVIDIA_API_KEYS = Deno.env.get('NVIDIA_API_KEYS') ?? '';
// @ts-ignore
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
// @ts-ignore
const GROQ_API_KEYS = Deno.env.get('GROQ_API_KEYS') ?? '';
// @ts-ignore
const CHAT_MODEL = Deno.env.get('CHAT_MODEL') ?? DEFAULT_MODEL;

loadKeys({
  anthropic: ANTHROPIC_API_KEY,
  nvidia: NVIDIA_API_KEY,
  nvidiaPlural: NVIDIA_API_KEYS,
  groq: GROQ_API_KEY,
  groqPlural: GROQ_API_KEYS,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ----- tool schemas (passed to Claude) -------------------------------------

const TOOLS = [
  {
    name: 'get_budget_by_year',
    description:
      'Return the 27 utgiftsområde (UO) breakdown plus the total for a single budget year. Amounts are in SEK. Use mode=real for inflation-adjusted values (KPI, base year from dim_year.cpi_index), gdp_pct for share of nominal GDP, total_pct for share of that year total.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Budget year, e.g. 2024.' },
        mode: {
          type: 'string',
          enum: ['nominal', 'real', 'gdp_pct', 'total_pct'],
          description: 'How to express amounts.',
        },
      },
      required: ['year', 'mode'],
    },
  },
  {
    name: 'get_area_time_series',
    description:
      'Time series for a single utgiftsområde across a year range. Pass area_code (e.g. "UO06" for Försvar) or use search_areas first if you are not sure.',
    input_schema: {
      type: 'object',
      properties: {
        area_code: { type: 'string' },
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        mode: {
          type: 'string',
          enum: ['nominal', 'real', 'gdp_pct', 'total_pct'],
        },
      },
      required: ['area_code', 'year_from', 'year_to', 'mode'],
    },
  },
  {
    name: 'get_total_time_series',
    description: 'Total state budget expenditure per year across a range.',
    input_schema: {
      type: 'object',
      properties: {
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
      },
      required: ['year_from', 'year_to'],
    },
  },
  {
    name: 'search_areas',
    description:
      'Fuzzy search of utgiftsområde names (Swedish and English). Returns at most 8 matches with area_id, code, and names.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_historical_snapshot',
    description:
      'Legacy huvudtitel breakdown for one of the historical snapshot years: 1975, 1980, 1985. Use this for 50-year retrospectives.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'integer', enum: [1975, 1980, 1985] },
      },
      required: ['year'],
    },
  },
  {
    name: 'get_year_meta',
    description:
      'Meta info for a year: KPI/CPI index and nominal GDP in SEK. Use for inflation math or GDP-share calculations.',
    input_schema: {
      type: 'object',
      properties: { year: { type: 'integer' } },
      required: ['year'],
    },
  },
  {
    name: 'get_skatteutgifter',
    description:
      'Skatteutgifter (tax expenditures). Covers the full ~150-item list from regeringens "Redovisning av skatteutgifter" (skr. 2024/25:98) — every item in sections A (inkomst av tjänst, A1..A41), B (näringsverksamhet, B1..B29), C (kapital, C1..C18), D (socialavgifter, D1..D10), E (mervärdesskatt, E1..E17), F (punktskatter, F1..F22), G (skattereduktioner, G1..G12). Amounts in Mkr (miljoner kronor) for 2024 (utfall), 2025 och 2026 (prognos). Items the bilaga leaves unquantified still have dim rows but no facts — those appear in the `codes_with_no_data` field. Extra: EXTRA_RANTEAVDRAG comes from ESV outside the bilaga (ränteavdraget räknas inte längre som skatteutgift). If you donʼt know the code, call search_skatteutgifter first. ROT = G4, RUT = G3, Jobbskatteavdrag = G11, Förhöjt grundavdrag pensionärer = A41, reducerad moms livsmedel = E1, reducerad energiskatt industri = F13.',
    input_schema: {
      type: 'object',
      properties: {
        year_from: { type: 'integer' },
        year_to: { type: 'integer' },
        codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional code filter, e.g. ["G3","G4"] or ["EXTRA_RANTEAVDRAG"]. Omit to return everything.',
        },
      },
      required: ['year_from', 'year_to'],
    },
  },
  {
    name: 'search_skatteutgifter',
    description:
      'Fuzzy search the skatteutgifter master list (150 items) by Swedish name, English name, or bilaga code. Returns up to 10 matches with code, name_sv, name_en, and a boolean has_data flag. Use this when the user asks about a skatteutgift by name and you need its code to pass to get_skatteutgifter.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'compare_parties',
    description:
      'Returns the governing baseline budget by utgiftsområde for a year plus each requested opposition partyʼs shadow-budget delta. Returns {gov: [...], deltas: {PARTY: [...]}}. If shadow_delta rows are missing, deltas will be empty — that is expected.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        party_codes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Party codes, e.g. ["S","M","SD"].',
        },
      },
      required: ['year', 'party_codes'],
    },
  },
];

// ----- tool implementations ------------------------------------------------

type Mode = 'nominal' | 'real' | 'gdp_pct' | 'total_pct';

async function fetchYearMeta(year: number) {
  const { data, error } = await supabase
    .from('dim_year')
    .select('year_id, cpi_index, gdp_nominal_sek, is_historical')
    .eq('year_id', year)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function convert(amount: number, mode: Mode, cpi: number, gdp: number, total: number) {
  switch (mode) {
    case 'nominal':
      return amount;
    case 'real':
      return cpi ? (amount / cpi) * 100 : amount;
    case 'gdp_pct':
      return gdp ? (amount / gdp) * 100 : 0;
    case 'total_pct':
      return total ? (amount / total) * 100 : 0;
  }
}

async function toolGetBudgetByYear(args: { year: number; mode: Mode }) {
  const year = args.year;
  const mode = args.mode;
  const [yearMeta, areas, facts] = await Promise.all([
    fetchYearMeta(year),
    supabase.from('dim_area').select('area_id, code, name_sv, name_en, sort_order').order('sort_order'),
    supabase
      .from('fact_budget')
      .select('area_id, amount_nominal_sek')
      .eq('year_id', year)
      .eq('is_revenue', false)
      .eq('budget_type', 'actual')
      .is('anslag_id', null),
  ]);
  if (!yearMeta) return { error: `no data for year ${year}` };
  if (areas.error) throw areas.error;
  if (facts.error) throw facts.error;
  const areaMap = new Map<number, { code: string; name_sv: string; name_en: string }>();
  for (const a of areas.data ?? []) areaMap.set(a.area_id, a);
  const total = (facts.data ?? []).reduce((s, r) => s + Number(r.amount_nominal_sek ?? 0), 0);
  const rows = (facts.data ?? [])
    .map((r) => {
      const a = areaMap.get(r.area_id);
      const amt = convert(Number(r.amount_nominal_sek ?? 0), mode, yearMeta.cpi_index, yearMeta.gdp_nominal_sek, total);
      return { code: a?.code, name_sv: a?.name_sv, name_en: a?.name_en, amount: amt };
    })
    .filter((r) => r.code)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const totalOut = convert(total, mode, yearMeta.cpi_index, yearMeta.gdp_nominal_sek, total);
  return { year, mode, unit: mode === 'nominal' || mode === 'real' ? 'SEK' : 'percent', total: totalOut, breakdown: rows };
}

async function toolGetAreaTimeSeries(args: { area_code: string; year_from: number; year_to: number; mode: Mode }) {
  const { data: area, error: areaErr } = await supabase
    .from('dim_area')
    .select('area_id, code, name_sv, name_en')
    .eq('code', args.area_code)
    .maybeSingle();
  if (areaErr) throw areaErr;
  if (!area) return { error: `unknown area_code ${args.area_code}` };
  const { data: years, error: yearsErr } = await supabase
    .from('dim_year')
    .select('year_id, cpi_index, gdp_nominal_sek')
    .gte('year_id', args.year_from)
    .lte('year_id', args.year_to)
    .order('year_id');
  if (yearsErr) throw yearsErr;
  const { data: facts, error: factsErr } = await supabase
    .from('fact_budget')
    .select('year_id, amount_nominal_sek')
    .eq('area_id', area.area_id)
    .eq('is_revenue', false)
    .eq('budget_type', 'actual')
    .is('anslag_id', null)
    .gte('year_id', args.year_from)
    .lte('year_id', args.year_to);
  if (factsErr) throw factsErr;
  // Totals per year for total_pct mode.
  const { data: totals } = await supabase
    .from('fact_budget')
    .select('year_id, amount_nominal_sek')
    .eq('is_revenue', false)
    .eq('budget_type', 'actual')
    .is('anslag_id', null)
    .gte('year_id', args.year_from)
    .lte('year_id', args.year_to);
  const totalsByYear = new Map<number, number>();
  for (const r of totals ?? []) {
    totalsByYear.set(r.year_id, (totalsByYear.get(r.year_id) ?? 0) + Number(r.amount_nominal_sek ?? 0));
  }
  const factByYear = new Map<number, number>();
  for (const r of facts ?? []) factByYear.set(r.year_id, Number(r.amount_nominal_sek ?? 0));
  const series = (years ?? []).map((y) => {
    const raw = factByYear.get(y.year_id) ?? 0;
    return {
      year: y.year_id,
      amount: convert(raw, args.mode, y.cpi_index, y.gdp_nominal_sek, totalsByYear.get(y.year_id) ?? 0),
    };
  });
  return { area: { code: area.code, name_sv: area.name_sv, name_en: area.name_en }, mode: args.mode, series };
}

async function toolGetTotalTimeSeries(args: { year_from: number; year_to: number }) {
  const { data: rows, error } = await supabase
    .from('fact_budget')
    .select('year_id, amount_nominal_sek')
    .eq('is_revenue', false)
    .eq('budget_type', 'actual')
    .is('anslag_id', null)
    .gte('year_id', args.year_from)
    .lte('year_id', args.year_to);
  if (error) throw error;
  const byYear = new Map<number, number>();
  for (const r of rows ?? []) byYear.set(r.year_id, (byYear.get(r.year_id) ?? 0) + Number(r.amount_nominal_sek ?? 0));
  const series = Array.from(byYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, amount]) => ({ year, amount_nominal_sek: amount }));
  return { series };
}

async function toolSearchAreas(args: { query: string }) {
  const q = args.query.trim();
  if (!q) return { matches: [] };
  // Use ilike on both name columns.
  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from('dim_area')
    .select('area_id, code, name_sv, name_en')
    .or(`name_sv.ilike.${pattern},name_en.ilike.${pattern},code.ilike.${pattern}`)
    .limit(8);
  if (error) throw error;
  return { matches: data ?? [] };
}

async function toolGetHistoricalSnapshot(args: { year: number }) {
  const { data, error } = await supabase
    .from('fact_budget')
    .select('area_id, amount_nominal_sek, dim_area(code, name_sv, name_en)')
    .eq('year_id', args.year)
    .eq('is_revenue', false)
    .is('anslag_id', null);
  if (error) throw error;
  return { year: args.year, rows: data ?? [] };
}

async function toolGetYearMeta(args: { year: number }) {
  const meta = await fetchYearMeta(args.year);
  if (!meta) return { error: `no data for year ${args.year}` };
  return meta;
}

async function toolCompareParties(args: { year: number; party_codes: string[] }) {
  const { data: parties, error: partyErr } = await supabase
    .from('dim_party')
    .select('party_id, code, name_sv')
    .in('code', args.party_codes);
  if (partyErr) throw partyErr;
  const partyIds = (parties ?? []).map((p) => p.party_id);
  const { data: gov, error: govErr } = await supabase
    .from('fact_budget')
    .select('area_id, amount_nominal_sek, dim_area(code, name_sv)')
    .eq('year_id', args.year)
    .eq('budget_type', 'actual')
    .is('anslag_id', null);
  if (govErr) throw govErr;
  let deltas: unknown[] = [];
  if (partyIds.length) {
    const { data: deltaRows } = await supabase
      .from('fact_budget')
      .select('party_id, area_id, amount_nominal_sek, dim_area(code, name_sv)')
      .eq('year_id', args.year)
      .eq('budget_type', 'shadow_delta')
      .in('party_id', partyIds);
    deltas = deltaRows ?? [];
  }
  return { year: args.year, gov: gov ?? [], deltas, parties: parties ?? [] };
}

async function toolGetSkatteutgifter(args: {
  year_from: number;
  year_to: number;
  codes?: string[];
}) {
  const { data: dims, error: dimErr } = await supabase
    .from('dim_skatteutgift')
    .select('skatteutgift_id, code, name_sv, name_en, sort_order')
    .order('sort_order');
  if (dimErr) throw dimErr;
  const wantedCodes = args.codes && args.codes.length ? new Set(args.codes) : null;
  const filteredDims = (dims ?? []).filter((d) => !wantedCodes || wantedCodes.has(d.code));
  if (filteredDims.length === 0) return { error: 'no matching skatteutgifter codes' };
  const idToDim = new Map<number, { code: string; name_sv: string; name_en: string | null }>();
  for (const d of filteredDims) idToDim.set(d.skatteutgift_id, d);
  const { data: facts, error: factErr } = await supabase
    .from('fact_skatteutgift')
    .select('year_id, skatteutgift_id, amount_mkr, is_estimated')
    .gte('year_id', args.year_from)
    .lte('year_id', args.year_to)
    .in('skatteutgift_id', filteredDims.map((d) => d.skatteutgift_id));
  if (factErr) throw factErr;
  const rows = (facts ?? [])
    .map((f) => {
      const dim = idToDim.get(f.skatteutgift_id);
      if (!dim) return null;
      return {
        code: dim.code,
        name_sv: dim.name_sv,
        name_en: dim.name_en,
        year: f.year_id,
        amount_mkr: Number(f.amount_mkr),
        is_estimated: f.is_estimated,
      };
    })
    .filter((r) => r !== null)
    .sort((a, b) => (a!.code < b!.code ? -1 : a!.code > b!.code ? 1 : a!.year - b!.year));
  const missingCodes = filteredDims
    .filter((d) => !rows.some((r) => r!.code === d.code))
    .map((d) => d.code);
  return {
    unit: 'Mkr',
    note:
      'Source: regeringens skatteutgiftsbilaga (skr. 20XX/XX:98). Amounts in miljoner kronor.',
    rows,
    codes_with_no_data: missingCodes,
  };
}

async function toolSearchSkatteutgifter(args: { query: string }) {
  const q = args.query.trim();
  if (!q) return { matches: [] };
  const pattern = `%${q}%`;
  const { data: dims, error } = await supabase
    .from('dim_skatteutgift')
    .select('skatteutgift_id, code, name_sv, name_en')
    .or(`name_sv.ilike.${pattern},name_en.ilike.${pattern},code.ilike.${pattern}`)
    .limit(10);
  if (error) throw error;
  const ids = (dims ?? []).map((d) => d.skatteutgift_id);
  const hasData = new Set<number>();
  if (ids.length) {
    const { data: factIds } = await supabase
      .from('fact_skatteutgift')
      .select('skatteutgift_id')
      .in('skatteutgift_id', ids);
    for (const r of factIds ?? []) hasData.add(r.skatteutgift_id);
  }
  return {
    matches: (dims ?? []).map((d) => ({
      code: d.code,
      name_sv: d.name_sv,
      name_en: d.name_en,
      has_data: hasData.has(d.skatteutgift_id),
    })),
  };
}

async function runTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'get_budget_by_year':
        return await toolGetBudgetByYear(input as { year: number; mode: Mode });
      case 'get_area_time_series':
        return await toolGetAreaTimeSeries(
          input as { area_code: string; year_from: number; year_to: number; mode: Mode },
        );
      case 'get_total_time_series':
        return await toolGetTotalTimeSeries(input as { year_from: number; year_to: number });
      case 'search_areas':
        return await toolSearchAreas(input as { query: string });
      case 'get_historical_snapshot':
        return await toolGetHistoricalSnapshot(input as { year: number });
      case 'get_year_meta':
        return await toolGetYearMeta(input as { year: number });
      case 'compare_parties':
        return await toolCompareParties(input as { year: number; party_codes: string[] });
      case 'get_skatteutgifter':
        return await toolGetSkatteutgifter(
          input as { year_from: number; year_to: number; codes?: string[] },
        );
      case 'search_skatteutgifter':
        return await toolSearchSkatteutgifter(input as { query: string });
      default:
        return { error: `unknown tool ${name}` };
    }
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// ----- prompts -------------------------------------------------------------

function systemPrompt(lang: 'sv' | 'en'): string {
  const langLine =
    lang === 'en'
      ? 'Answer in English unless the user writes in Swedish.'
      : 'Svara på svenska om inte användaren skriver på engelska.';
  return [
    'You are a Swedish state budget expert assistant for Statsbudget (statsbudget.se).',
    'You help ordinary citizens understand where their tax money goes.',
    '',
    'Rules:',
    '- Prefer exact tool calls over guessing. Never invent numbers.',
    '- Always cite the year(s) the data is from.',
    '- Amounts are SEK. Use "mdr kr" for billions, "mkr" for millions.',
    "- If a tool returns empty or an error, say \"jag har inte data om det\" (or the English equivalent) rather than guessing.",
    '- For inflation comparisons always use mode="real".',
    '- Be concise. Use markdown: **bold** amounts, bullet lists for breakdowns.',
    '- ' + langLine,
    '',
    'Skatteutgifter (tax expenditures):',
    'Use get_skatteutgifter for values and search_skatteutgifter to look up a',
    'bilaga code by keyword. Full coverage of regeringens skr. 2024/25:98',
    '"Redovisning av skatteutgifter" — ~150 items across sections A (inkomst av',
    'tjänst, A1..A41), B (näringsverksamhet, B1..B29), C (kapital, C1..C18),',
    'D (socialavgifter, D1..D10), E (moms, E1..E17), F (punktskatter, F1..F22),',
    'G (skattereduktioner, G1..G12). Years: 2024 utfall, 2025–2026 prognos.',
    'Amounts are in Mkr. Popular items by code:',
    '  ROT = G4,  RUT = G3,  Jobbskatteavdrag = G11,',
    '  Förhöjt grundavdrag äldre = A41,  Skattelättnader utländska nyckelpersoner = A12,',
    '  Moms livsmedel 12% = E1,  Moms kultur/idrott 6% = E7,',
    '  Nedsatt energiskatt industri = F13.',
    'If an item has a dim row but no fact rows (appears in codes_with_no_data),',
    'it means bilagan skriver "beloppet kan ej beräknas" — säg det, hitta INTE',
    'på ett belopp.',
    '',
    'EXTRA_RANTEAVDRAG (ränteavdraget, hushåll) is a special case.',
    'Sedan skr. 2024/25:98 räknas det INTE längre som en skatteutgift av regeringen',
    '— de anser att 30 % skattereduktion är normskattesatsen för kapital. Den',
    'siffra som journalister citerar (61 mdr för 2024) kommer från ESV:s separata',
    'beräkning av statens kostnad för hushållens ränteutgifter, baserad på SCB-data.',
    'Vi har lagt in 2020 (28 mdr), 2023 (51 mdr) och 2024 (61 mdr) i datasetet under',
    'koden EXTRA_RANTEAVDRAG. När du citerar ränteavdraget: nämn att källan är',
    'ESV/SCB hushållsdata, INTE skatteutgiftsbilagan, och förklara reklassificeringen',
    'om det är relevant.',
    '',
    'Skatteutgifter live on the revenue side under inkomsttitel 1700-serien,',
    'NOT as anslag.',
    '',
    'Partiernas skuggbudgetar (compare_parties tool):',
    'Real shadow budgets from riksdagens budgetmotioner cover S, V, MP, C for',
    'both 2025 (BP25 motioner, Oct 2024) and 2026 (BP26 motioner, Oct 2025).',
    'M, KD, L are coalition parties so their "delta" = 0 (regeringens budget).',
    'SD has no independent budgetmotion and also = 0. Numbers are per',
    'utgiftsområde i mkr, avvikelse från regeringens förslag.',
    '',
    'IMPORTANT — what is NOT in the database (yet):',
    '  - Inkomstsidan (revenue side) generally — momsintäkter, arbetsgivar-',
    '    avgifter, kapitalinkomstskatt etc. Not yet ingested.',
    '',
    'When a user asks about inkomster (revenue) or specific tax types not',
    'covered by get_skatteutgifter, say the app currently only covers',
    'utgiftssidan + de största skatteutgifterna and point at ESV/SCB.',
  ].join('\n');
}

// ----- Anthropic streaming call --------------------------------------------

/**
 * Open Anthropic's SSE Messages endpoint and call back on every relevant
 * delta. The caller's `onText` is invoked once per text token as it arrives.
 * The function accumulates tool_use blocks and returns the full content
 * array so the caller can re-feed them in the next iteration.
 */
async function streamAnthropic(
  messages: AnthropicMessage[],
  system: string,
  modelId: string,
  callbacks: {
    onText: (delta: string) => void;
    onToolUse: (block: AnthropicToolUseBlock) => void;
  },
): Promise<StreamResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      stream: true,
      system,
      tools: TOOLS,
      messages,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`anthropic ${res.status}: ${text}`);
  }

  // Per content-block accumulators, indexed by Anthropic's `index` field.
  type BlockBuilder =
    | { kind: 'text'; text: string }
    | { kind: 'tool_use'; id: string; name: string; partialJson: string };
  const builders = new Map<number, BlockBuilder>();
  let stopReason = 'end_turn';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Anthropic SSE frames are separated by blank lines (\n\n).
    let sepIdx: number;
    while ((sepIdx = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      if (!frame.trim()) continue;

      // A frame is "event: ...\ndata: ...". We only care about data lines.
      let eventName = '';
      let dataPayload = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        else if (line.startsWith('data:')) dataPayload += line.slice(5).trim();
      }
      if (!dataPayload || dataPayload === '[DONE]') continue;

      let json: any;
      try {
        json = JSON.parse(dataPayload);
      } catch {
        continue;
      }

      switch (eventName) {
        case 'content_block_start': {
          const block = json.content_block;
          if (block?.type === 'text') {
            builders.set(json.index, { kind: 'text', text: '' });
          } else if (block?.type === 'tool_use') {
            builders.set(json.index, {
              kind: 'tool_use',
              id: block.id,
              name: block.name,
              partialJson: '',
            });
          }
          break;
        }
        case 'content_block_delta': {
          const delta = json.delta;
          const builder = builders.get(json.index);
          if (!builder) break;
          if (delta?.type === 'text_delta' && builder.kind === 'text') {
            builder.text += delta.text;
            callbacks.onText(delta.text);
          } else if (delta?.type === 'input_json_delta' && builder.kind === 'tool_use') {
            builder.partialJson += delta.partial_json ?? '';
          }
          break;
        }
        case 'content_block_stop': {
          const builder = builders.get(json.index);
          if (builder?.kind === 'tool_use') {
            // Finalise + emit so the client can render a "running tool" pill.
            let parsed: Record<string, unknown> = {};
            try {
              parsed = builder.partialJson ? JSON.parse(builder.partialJson) : {};
            } catch {
              /* leave empty */
            }
            const finalised: AnthropicToolUseBlock = {
              type: 'tool_use',
              id: builder.id,
              name: builder.name,
              input: parsed,
            };
            callbacks.onToolUse(finalised);
            // Replace the builder with the finalised block as a marker.
            (builder as unknown as { finalised: AnthropicToolUseBlock }).finalised = finalised;
          }
          break;
        }
        case 'message_delta': {
          if (json.delta?.stop_reason) stopReason = json.delta.stop_reason;
          break;
        }
        case 'message_stop':
        case 'message_start':
        case 'ping':
        default:
          break;
      }
    }
  }

  // Materialise final content array in index order.
  const indexes = [...builders.keys()].sort((a, b) => a - b);
  const content: AnthropicContentBlock[] = indexes.map((i) => {
    const b = builders.get(i)!;
    if (b.kind === 'text') {
      return { type: 'text', text: b.text };
    }
    const finalised = (b as unknown as { finalised?: AnthropicToolUseBlock }).finalised;
    return finalised ?? {
      type: 'tool_use',
      id: b.id,
      name: b.name,
      input: (() => {
        try { return b.partialJson ? JSON.parse(b.partialJson) : {}; } catch { return {}; }
      })(),
    };
  });

  return { content, stopReason };
}

// ----- HTTP handler --------------------------------------------------------

// @ts-ignore - Deno.serve is provided by the Supabase Edge runtime.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  // Fail fast if no provider has any keys at all.
  if (
    !hasProviderKeys('nvidia') &&
    !hasProviderKeys('groq') &&
    !hasProviderKeys('anthropic')
  ) {
    return new Response(
      JSON.stringify({ ok: false, error: 'server_not_configured' }),
      { status: 503, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
    );
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const cooldown = checkRateLimit(ip);
  if (cooldown) {
    return new Response(
      JSON.stringify({ ok: false, error: 'rate_limited', retry_after_seconds: cooldown }),
      { status: 429, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'bad_json' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }

  const lang: 'sv' | 'en' = body.lang === 'en' ? 'en' : 'sv';
  const system = systemPrompt(lang);
  const conversation: AnthropicMessage[] = [...(body.messages ?? [])];

  // Resolve model: per-request override wins, else CHAT_MODEL env, else
  // DEFAULT_MODEL. Unknown ids fall back to the configured default so a
  // stale client cannot break the endpoint.
  const requestedModelId =
    (typeof body.model === 'string' && body.model.trim()) || CHAT_MODEL;
  const modelInfo: ModelInfo =
    resolveModel(requestedModelId) ?? resolveModel(CHAT_MODEL) ?? resolveModel(DEFAULT_MODEL)!;

  if (!hasProviderKeys(modelInfo.provider)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'provider_not_configured',
        provider: modelInfo.provider,
      }),
      { status: 503, headers: { ...CORS_HEADERS, 'content-type': 'application/json' } },
    );
  }

  // We stream our own SSE protocol to the client. Events:
  //   event: text           data: {"text":"partial token"}
  //   event: tool_use       data: {"name":"get_budget_by_year","input":{...}}
  //   event: tool_result    data: {"name":"...","ok":true}
  //   event: error          data: {"message":"..."}
  //   event: done           data: {}
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          const callbacks = {
            onText: (delta: string) => send('text', { text: delta }),
            onToolUse: (block: AnthropicToolUseBlock) =>
              send('tool_use', { id: block.id, name: block.name, input: block.input }),
          };
          const result: StreamResult =
            modelInfo.provider === 'anthropic'
              ? await streamAnthropic(
                  conversation,
                  system,
                  modelInfo.providerModelId,
                  callbacks,
                )
              : await streamOpenAICompat({
                  model: modelInfo,
                  messages: conversation,
                  system,
                  tools: TOOLS,
                  callbacks,
                });

          if (result.stopReason !== 'tool_use') {
            send('done', {});
            controller.close();
            return;
          }

          // Append the assistant's full content (text + tool_use blocks) to
          // the conversation, then run every tool and feed results back as
          // a user turn.
          conversation.push({ role: 'assistant', content: result.content });
          const toolResults: AnthropicToolResultBlock[] = [];
          for (const block of result.content) {
            if (block.type !== 'tool_use') continue;
            const out = await runTool(block.name, block.input);
            send('tool_result', { name: block.name, ok: !(out as any)?.error });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(out).slice(0, 20_000),
              is_error: !!(out as any)?.error,
            });
          }
          conversation.push({ role: 'user', content: toolResults });
        }
        send('error', { message: 'tool_loop_limit' });
        send('done', {});
        controller.close();
      } catch (err) {
        send('error', { message: (err as Error).message });
        send('done', {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
    },
  });
});
