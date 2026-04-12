export interface DimYear {
  year_id: number;
  cpi_index: number;
  gdp_nominal_sek: number;
  is_historical: boolean;
  riksdagen_proposition_url?: string | null;
  riksdagen_proposition_title?: string | null;
  riksdagen_decision_url?: string | null;
  riksdagen_decision_title?: string | null;
  historical_context_sv?: string | null;
  historical_source_url?: string | null;
  historical_source_title?: string | null;
  historical_confidence?: string | null;
  fiscal_year_label?: string | null;
}

export interface DimSkatteutgift {
  skatteutgift_id: number;
  code: string;
  name_sv: string;
  name_en: string | null;
  description_sv: string | null;
  description_en: string | null;
  thematic_area_id: number | null;
  sort_order: number;
}

export interface FactSkatteutgift {
  fact_id: number;
  year_id: number;
  skatteutgift_id: number;
  amount_mkr: number;
  is_estimated: boolean;
}

export interface FactHistorical {
  fact_id: number;
  year_id: number;
  category_sv: string;
  sort_order: number;
  amount_mkr: number;
  is_uncertain: boolean;
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
