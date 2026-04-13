import { supabase } from '@/integrations/supabase/client';
import type {
  DimYear, DimArea, DimAnslag, DimParty, FactBudget, FactHistorical, DisplayMode,
  DimSkatteutgift, FactSkatteutgift,
  DimIncomeTitle, DimIncomeOutcomeTitle, FactIncome, FactIncomeOutcomeMonth, FactIncomeOutcomeQuarterly,
} from './supabase-types';

// The tables exist in the DB but aren't in the auto-generated types yet.
// We cast to any for .from() calls and type the results manually.
const db = supabase as any;

export async function getYears(): Promise<DimYear[]> {
  const { data, error } = await db.from('dim_year').select('*').order('year_id', { ascending: true });
  if (error) throw error;
  return data as DimYear[];
}

/** Distinct years that actually have fact_budget rows. */
export async function getBudgetYears(): Promise<number[]> {
  const { data, error } = await db
    .from('fact_budget')
    .select('year_id')
    .eq('is_revenue', false)
    .eq('budget_type', 'actual')
    .is('anslag_id', null);
  if (error) throw error;
  const set = new Set<number>((data as { year_id: number }[]).map((r) => r.year_id));
  return [...set].sort((a, b) => a - b);
}

export async function getAreas(): Promise<DimArea[]> {
  const { data, error } = await db.from('dim_area').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return data as DimArea[];
}

export async function getParties(): Promise<DimParty[]> {
  const { data, error } = await db.from('dim_party').select('*').order('party_id', { ascending: true });
  if (error) throw error;
  return data as DimParty[];
}

export async function getAnslagByArea(areaId: number): Promise<DimAnslag[]> {
  const { data, error } = await db.from('dim_anslag').select('*').eq('area_id', areaId).order('code', { ascending: true });
  if (error) throw error;
  return data as DimAnslag[];
}

export async function getBudgetByYear(
  year: number,
  level: 'area' | 'anslag' = 'area',
  areaId?: number
): Promise<FactBudget[]> {
  let query = db.from('fact_budget').select('*').eq('year_id', year).eq('is_revenue', false);
  if (level === 'area') {
    query = query.is('anslag_id', null);
  } else if (areaId) {
    query = query.eq('area_id', areaId).not('anslag_id', 'is', null);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as FactBudget[];
}

export async function getAreaTimeSeries(areaId: number, yearFrom: number, yearTo: number): Promise<FactBudget[]> {
  const { data, error } = await db.from('fact_budget').select('*')
    .eq('area_id', areaId).is('anslag_id', null).eq('is_revenue', false)
    .gte('year_id', yearFrom).lte('year_id', yearTo).order('year_id', { ascending: true });
  if (error) throw error;
  return data as FactBudget[];
}

export async function getAllTimeSeries(yearFrom: number, yearTo: number): Promise<FactBudget[]> {
  const { data, error } = await db.from('fact_budget').select('*')
    .is('anslag_id', null).eq('is_revenue', false)
    .gte('year_id', yearFrom).lte('year_id', yearTo).order('year_id', { ascending: true });
  if (error) throw error;
  return data as FactBudget[];
}

export async function getPartyComparison(year: number, partyIds: number[]): Promise<FactBudget[]> {
  const { data, error } = await db.from('fact_budget').select('*')
    .eq('year_id', year).is('anslag_id', null).eq('is_revenue', false).in('party_id', partyIds);
  if (error) throw error;
  return data as FactBudget[];
}

export async function getHistoricalSnapshot(year: number): Promise<FactBudget[]> {
  const { data, error } = await db.from('fact_budget').select('*')
    .eq('year_id', year).is('anslag_id', null).eq('is_revenue', false);
  if (error) throw error;
  return data as FactBudget[];
}

export async function getHistoricalFact(year: number): Promise<FactHistorical[]> {
  const { data, error } = await db.from('fact_historical').select('*')
    .eq('year_id', year).order('sort_order', { ascending: true });
  if (error) throw error;
  return data as FactHistorical[];
}

export async function getHistoricalYearMeta(year: number): Promise<DimYear | null> {
  const { data, error } = await db.from('dim_year').select('*').eq('year_id', year).maybeSingle();
  if (error) throw error;
  return data as DimYear | null;
}

// ---------- Skatteutgifter (tax expenditures) ----------

export async function getSkatteutgifter(): Promise<DimSkatteutgift[]> {
  const { data, error } = await db.from('dim_skatteutgift').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimSkatteutgift[];
}

export async function getSkatteutgiftFacts(year: number): Promise<FactSkatteutgift[]> {
  const { data, error } = await db.from('fact_skatteutgift').select('*').eq('year_id', year);
  if (error) throw error;
  return (data ?? []) as FactSkatteutgift[];
}

export async function getSkatteutgiftTimeSeries(): Promise<FactSkatteutgift[]> {
  const { data, error } = await db.from('fact_skatteutgift').select('*').order('year_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FactSkatteutgift[];
}

// ---------- Skatteintakter (tax revenues) ----------

export async function getIncomeGroups(): Promise<DimIncomeTitle[]> {
  const { data, error } = await db
    .from('dim_income_title')
    .select('*')
    .is('parent_id', null)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimIncomeTitle[];
}

export async function getAllIncomeTitles(): Promise<DimIncomeTitle[]> {
  const { data, error } = await db
    .from('dim_income_title')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimIncomeTitle[];
}

export async function getIncomeSubtitles(parentId: number): Promise<DimIncomeTitle[]> {
  const { data, error } = await db
    .from('dim_income_title')
    .select('*')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimIncomeTitle[];
}

export async function getIncomeFacts(year: number): Promise<FactIncome[]> {
  const { data, error } = await db
    .from('fact_income')
    .select('*')
    .eq('year_id', year);
  if (error) throw error;
  return (data ?? []) as FactIncome[];
}

export async function getIncomeTimeSeries(): Promise<FactIncome[]> {
  // Fetch only top-level group facts for the time series chart.
  // This keeps the result well under Supabase's 1000-row default limit
  // (~9 groups × 27 years = ~243 rows vs ~1161 total).
  const groups = await getIncomeGroups();
  const groupIds = groups.map(g => g.income_title_id);
  const { data, error } = await db
    .from('fact_income')
    .select('*')
    .in('income_title_id', groupIds)
    .order('year_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FactIncome[];
}

export async function getIncomeOutcomeTitles(): Promise<DimIncomeOutcomeTitle[]> {
  const { data, error } = await db
    .from('dim_income_outcome_title')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DimIncomeOutcomeTitle[];
}

export async function getIncomeOutcomeMonthly(year: number): Promise<FactIncomeOutcomeMonth[]> {
  const { data, error } = await db
    .from('fact_income_outcome_month')
    .select('*')
    .eq('year_id', year)
    .order('month_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FactIncomeOutcomeMonth[];
}

export async function getIncomeOutcomeQuarterly(year: number): Promise<FactIncomeOutcomeQuarterly[]> {
  const { data, error } = await db
    .from('v_income_outcome_quarterly')
    .select('*')
    .eq('year_id', year)
    .order('quarter_id', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FactIncomeOutcomeQuarterly[];
}

export function convertAmount(amount: number, mode: DisplayMode, yearData: DimYear, totalForYear?: number): number {
  switch (mode) {
    case 'nominal': return amount;
    case 'real': return yearData.cpi_index ? amount / yearData.cpi_index * 100 : amount;
    case 'gdp_pct': return yearData.gdp_nominal_sek ? (amount / yearData.gdp_nominal_sek) * 100 : 0;
    case 'total_pct': return totalForYear ? (amount / totalForYear) * 100 : 0;
    default: return amount;
  }
}

export function formatAmount(value: number, mode: DisplayMode): string {
  switch (mode) {
    case 'nominal':
    case 'real':
      if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)} mdr kr`;
      if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(0)} mkr`;
      return `${value.toLocaleString('sv-SE')} kr`;
    case 'gdp_pct':
    case 'total_pct':
      return `${value.toFixed(1)}%`;
    default: return value.toString();
  }
}
