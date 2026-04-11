export interface DimYear {
  year_id: number;
  cpi_index: number;
  gdp_nominal_sek: number;
  is_historical: boolean;
}

export interface DimArea {
  area_id: number;
  code: string;
  name_sv: string;
  name_en: string;
  sort_order: number;
}

export interface DimAnslag {
  anslag_id: number;
  area_id: number;
  code: string;
  name_sv: string;
  name_en: string;
}

export interface DimParty {
  party_id: number;
  code: string;
  name_sv: string;
  color_hex: string;
}

export interface FactBudget {
  fact_id: number;
  year_id: number;
  area_id: number;
  anslag_id: number | null;
  party_id: number;
  budget_type: 'actual' | 'gov_proposed' | 'shadow_delta';
  amount_nominal_sek: number;
  is_revenue: boolean;
}

export type DisplayMode = 'total_pct' | 'real' | 'nominal' | 'gdp_pct';
export type DrillLevel = 'area' | 'anslag';
