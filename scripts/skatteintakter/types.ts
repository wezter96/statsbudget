// Shared types for the skatteintakter seeder.

export interface IncomeTitleDef {
  code: string;
  parent_code: string | null;
  name_sv: string;
  name_en: string;
  description_sv: string;
  sort_order: number;
}

export interface IncomeFact {
  year: number;
  /** Matches IncomeTitleDef.code */
  code: string;
  amount_mkr: number;
  is_estimated: boolean;
}

export type IncomeOutcomeLevel =
  | 'income_type'
  | 'income_main_group'
  | 'income_title_group'
  | 'income_title';

export interface IncomeOutcomeTitleDef {
  code: string;
  parent_code: string | null;
  level_key: IncomeOutcomeLevel;
  name_sv: string;
  sort_order: number;
}

export interface IncomeOutcomeMonthFact {
  year: number;
  month: number;
  code: string;
  amount_mkr: number;
  source_year: number;
  source_month: number;
  source_status: string;
}

export interface IncomeOutcomeSnapshot {
  titles: IncomeOutcomeTitleDef[];
  facts: IncomeOutcomeMonthFact[];
  source_year: number;
  source_month: number;
  source_status: string;
  source_url: string;
}
