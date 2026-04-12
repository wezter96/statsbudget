// Hand-maintained extras — items NOT in regeringens skatteutgiftsbilaga.
// The bilaga parser (parse-bilaga.ts) only knows about items the regeringen
// classifies as skatteutgifter. A few items that the public thinks of as
// "skatteavdrag" (most famously ränteavdraget på bostadslån) have been
// reclassified by the regeringen as part of the norm and are no longer
// reported in the bilaga. We still want them visible on the site, so we
// source them separately and merge them in here.
//
// IDs in the 9000-range to avoid collision with parsed bilaga IDs (1000–7999).

import type { SkatteutgiftDef, SkatteutgiftFact } from './types.ts';

export const EXTRA_DIMS: SkatteutgiftDef[] = [
  {
    skatteutgift_id: 9001,
    code: 'EXTRA_RANTEAVDRAG',
    name_sv: 'Ränteavdrag (hushåll)',
    name_en: 'Household interest deduction',
    description_sv:
      'Skattereduktion för ränteutgifter på bostads- och konsumtionslån. Ingår INTE i regeringens skatteutgiftsbilaga sedan översynen — regeringen betraktar 30 % skattereduktion som normskattesats för kapital och därmed inte en skatteutgift. Beloppen här kommer från ESV:s separata beräkning av statens kostnad för hushållens ränteutgifter.',
    description_en:
      'Tax credit for household interest expenses on mortgages and consumer loans. NOT included in the governmentʼs official tax expenditure report — the government treats the 30% credit as the benchmark capital tax rate and thus not a deviation. Figures here come from ESVʼs separate calculation of the state cost.',
    thematic_area_code: 'UO18',
    sort_order: 9001,
  },
];

export const EXTRA_FACTS: SkatteutgiftFact[] = [
  // Source: SVT 2024-12-28 "Rekordnota för ränteavdrag — 61 miljarder" (ESV).
  { year: 2020, code: 'EXTRA_RANTEAVDRAG', amount_mkr: 28000, is_estimated: false },
  { year: 2023, code: 'EXTRA_RANTEAVDRAG', amount_mkr: 51000, is_estimated: false },
  { year: 2024, code: 'EXTRA_RANTEAVDRAG', amount_mkr: 61000, is_estimated: false },
];
