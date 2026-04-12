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
