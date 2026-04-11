import { supabase } from '@/integrations/supabase/client';
import type { DimYear, DimArea, DimAnslag, DimParty, FactBudget, DisplayMode, DrillLevel } from './supabase-types';

export async function getYears(): Promise<DimYear[]> {
  const { data, error } = await supabase
    .from('dim_year')
    .select('*')
    .order('year_id', { ascending: true });
  if (error) throw error;
  return data as DimYear[];
}

export async function getAreas(): Promise<DimArea[]> {
  const { data, error } = await supabase
    .from('dim_area')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data as DimArea[];
}

export async function getParties(): Promise<DimParty[]> {
  const { data, error } = await supabase
    .from('dim_party')
    .select('*')
    .order('party_id', { ascending: true });
  if (error) throw error;
  return data as DimParty[];
}

export async function getBudgetByYear(
  year: number,
  level: DrillLevel = 'area',
  areaId?: number
): Promise<FactBudget[]> {
  let query = supabase
    .from('fact_budget')
    .select('*')
    .eq('year_id', year)
    .eq('is_revenue', false);

  if (level === 'area') {
    query = query.is('anslag_id', null);
  } else if (areaId) {
    query = query.eq('area_id', areaId).not('anslag_id', 'is', null);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as FactBudget[];
}

export async function getAreaTimeSeries(
  areaId: number,
  yearFrom: number,
  yearTo: number
): Promise<FactBudget[]> {
  const { data, error } = await supabase
    .from('fact_budget')
    .select('*')
    .eq('area_id', areaId)
    .is('anslag_id', null)
    .eq('is_revenue', false)
    .gte('year_id', yearFrom)
    .lte('year_id', yearTo)
    .order('year_id', { ascending: true });
  if (error) throw error;
  return data as FactBudget[];
}

export async function getAllTimeSeries(
  yearFrom: number,
  yearTo: number
): Promise<FactBudget[]> {
  const { data, error } = await supabase
    .from('fact_budget')
    .select('*')
    .is('anslag_id', null)
    .eq('is_revenue', false)
    .gte('year_id', yearFrom)
    .lte('year_id', yearTo)
    .order('year_id', { ascending: true });
  if (error) throw error;
  return data as FactBudget[];
}

export async function getPartyComparison(
  year: number,
  partyIds: number[]
): Promise<FactBudget[]> {
  const { data, error } = await supabase
    .from('fact_budget')
    .select('*')
    .eq('year_id', year)
    .is('anslag_id', null)
    .eq('is_revenue', false)
    .in('party_id', partyIds);
  if (error) throw error;
  return data as FactBudget[];
}

export async function getHistoricalSnapshot(year: number): Promise<FactBudget[]> {
  const { data, error } = await supabase
    .from('fact_budget')
    .select('*')
    .eq('year_id', year)
    .is('anslag_id', null)
    .eq('is_revenue', false);
  if (error) throw error;
  return data as FactBudget[];
}

export function convertAmount(
  amount: number,
  mode: DisplayMode,
  yearData: DimYear,
  totalForYear?: number
): number {
  switch (mode) {
    case 'nominal':
      return amount;
    case 'real':
      return yearData.cpi_index ? amount / yearData.cpi_index * 100 : amount;
    case 'gdp_pct':
      return yearData.gdp_nominal_sek ? (amount / yearData.gdp_nominal_sek) * 100 : 0;
    case 'total_pct':
      return totalForYear ? (amount / totalForYear) * 100 : 0;
    default:
      return amount;
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
    default:
      return value.toString();
  }
}
