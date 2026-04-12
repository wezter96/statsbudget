// Shared types for the skatteutgifter seeder.

export interface SkatteutgiftDef {
  skatteutgift_id: number;
  code: string;
  name_sv: string;
  name_en: string;
  description_sv: string;
  description_en: string;
  /** Area code (e.g. "UO18") — resolved to area_id at seed time. */
  thematic_area_code: string | null;
  sort_order: number;
}

export interface SkatteutgiftFact {
  year: number;
  /** Matches SkatteutgiftDef.code */
  code: string;
  amount_mkr: number;
  is_estimated: boolean;
}
