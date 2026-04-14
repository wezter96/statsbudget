/**
 * English names for the 27 utgiftsområden + the legacy huvudtitlar.
 *
 * Based on the Swedish Government Offices' own English translations of
 * statsbudgetens utgiftsområden. Keyed by `name_sv` (the canonical Swedish
 * name from `dim_area`) for stability — colors and DB joins still use the
 * Swedish name as the key.
 *
 * Anslag-level names are NOT translated — there are ~500 of them and most
 * don't have official English equivalents. They stay Swedish in both
 * languages, which is acceptable for an English audience reading Swedish
 * civic data.
 */

export const AREA_NAMES_EN: Record<string, string> = {
  // Modern 27 utgiftsområden
  'Rikets styrelse': 'Governance',
  'Samhällsekonomi och finansförvaltning': 'Economy and Financial Administration',
  'Skatt, tull och exekution': 'Taxation, Customs and Enforcement',
  'Rättsväsendet': 'The Judicial System',
  'Internationell samverkan': 'International Cooperation',
  'Försvar och samhällets krisberedskap': 'Defence and Contingency Measures',
  'Internationellt bistånd': 'International Development Assistance',
  'Migration': 'Migration',
  'Hälsovård, sjukvård och social omsorg': 'Health Care and Social Services',
  'Ekonomisk trygghet vid sjukdom och funktionsnedsättning':
    'Financial Security in Illness and Disability',
  'Ekonomisk trygghet vid ålderdom': 'Financial Security in Old Age',
  'Ekonomisk trygghet för familjer och barn': 'Financial Security for Families and Children',
  'Integration och jämställdhet': 'Integration and Gender Equality',
  'Arbetsmarknad och arbetsliv': 'Labour Market and Working Life',
  'Studiestöd': 'Student Financial Aid',
  'Utbildning och universitetsforskning': 'Education and Academic Research',
  'Kultur, medier, trossamfund och fritid': 'Culture, Media, Religious Communities and Leisure',
  'Samhällsplanering, bostadsförsörjning och byggande samt konsumentpolitik':
    'Community Planning, Housing, Construction and Consumer Policy',
  'Regional utveckling': 'Regional Development',
  'Klimat, miljö och natur': 'Climate, Environment and Nature',
  'Energi': 'Energy',
  'Kommunikationer': 'Communications',
  'Areella näringar, landsbygd och livsmedel': 'Agriculture, Rural Areas and Food',
  'Näringsliv': 'Industry and Trade',
  'Allmänna bidrag till kommuner': 'General Grants to Local Government',
  'Statsskuldsräntor m.m.': 'Interest on Central Government Debt',
  'Avgiften till Europeiska unionen': 'Contribution to the European Union',
  'Riksrevisionen': 'The Swedish National Audit Office',

  // Public-sector COFOG functions
  'Allmän offentlig förvaltning': 'General public services',
  'Försvar': 'Defence',
  'Allmän ordning och säkerhet': 'Public order and safety',
  'Näringslivsfrågor': 'Economic affairs',
  'Miljöskydd': 'Environmental protection',
  'Bostäder och samhällsutveckling': 'Housing and community amenities',
  'Hälso- och sjukvård': 'Health',
  'Fritid, kultur och religion': 'Recreation, culture and religion',
  'Utbildning': 'Education',
  'Socialt skydd': 'Social protection',

  // Legacy huvudtitlar (1975/1980/1985)
  'Socialdepartementet': 'Ministry of Health and Social Affairs',
  'Utbildningsdepartementet': 'Ministry of Education',
  'Försvarsdepartementet': 'Ministry of Defence',
  'Justitiedepartementet': 'Ministry of Justice',
  'Utrikesdepartementet': 'Ministry for Foreign Affairs',
  'Kommunikationsdepartementet': 'Ministry of Communications',
  'Arbetsmarknadsdepartementet': 'Ministry of Employment',
  'Bostadsdepartementet': 'Ministry of Housing',
  'Jordbruksdepartementet': 'Ministry of Agriculture',
  'Handelsdepartementet': 'Ministry of Trade',
  'Industridepartementet': 'Ministry of Industry',
  'Budgetdepartementet': 'Ministry of the Budget',
  'Ekonomidepartementet': 'Ministry of Economic Affairs',
  'Finansdepartementet': 'Ministry of Finance',
  'Civildepartementet': 'Ministry of Civil Service Affairs',
  'Kommundepartementet': 'Ministry for Local Government',
  'Räntor på statsskulden': 'Interest on Central Government Debt',
  'Kungl hov- och slottsstaterna': 'Royal Court and Royal Palaces',
  'Riksdagen och dess myndigheter': 'The Riksdag and its Agencies',
  'Oförutsedda utgifter': 'Contingencies',
};

export type Lang = 'sv' | 'en';

/** Return the area name in the requested language; falls back to Swedish. */
export function localizeAreaName(nameSv: string, lang: Lang): string {
  if (lang === 'sv') return nameSv;
  return AREA_NAMES_EN[nameSv] ?? nameSv;
}

import { useTranslation } from 'react-i18next';

/** React-friendly hook that picks the active language automatically. */
export function useAreaName() {
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language?.startsWith('en') ? 'en' : 'sv';
  return (nameSv: string) => localizeAreaName(nameSv, lang);
}

/** Hook that returns the active language as a typed enum. */
export function useActiveLang(): Lang {
  const { i18n } = useTranslation();
  return i18n.language?.startsWith('en') ? 'en' : 'sv';
}

/** Format an amount in Mkr with localized unit suffixes. */
export function formatMkrLocalized(mkr: number, lang: Lang): string {
  if (lang === 'en') {
    if (Math.abs(mkr) >= 1000) return `${(mkr / 1000).toFixed(1)} bn SEK`;
    return `${Math.round(mkr).toLocaleString('en-US')} m SEK`;
  }
  if (Math.abs(mkr) >= 1000) return `${(mkr / 1000).toFixed(1)} mdr kr`;
  return `${Math.round(mkr).toLocaleString('sv-SE')} mkr`;
}

/** Compact format for tight mobile layouts — drops trailing unit word. */
export function formatMkrCompact(mkr: number, lang: Lang): string {
  if (lang === 'en') {
    if (Math.abs(mkr) >= 1000) return `${(mkr / 1000).toFixed(1)} bn`;
    return `${Math.round(mkr).toLocaleString('en-US')} m`;
  }
  if (Math.abs(mkr) >= 1000) return `${(mkr / 1000).toFixed(1)} mdr`;
  return `${Math.round(mkr).toLocaleString('sv-SE')} mkr`;
}
