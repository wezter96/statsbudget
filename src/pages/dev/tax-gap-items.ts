// Hand-curated review list of items that reduce Swedish tax revenue but
// are either (a) not in our current dataset, (b) reclassified out of
// ESV's skatteutgiftsbilaga, or (c) never part of any official budget
// accounting at all.
//
// PURPOSE: review only. This file feeds a __DEV__ gated page at
// /dev/tax-gaps where we can eyeball the list and decide what to ingest.
// Nothing here is shown to end users.
//
// IMPORTANT — confidence levels:
//   high   — figure comes directly from ESV, Skatteverket, SCB, or a
//            government skrivelse with a named year.
//   medium — figure is a reasonable estimate reported by a named
//            institution (Finanspolitiska rådet, LO/Katalys, SNS, etc)
//            or derived from an old official figure updated for today.
//   low    — figure is a rough order-of-magnitude guess from secondary
//            reporting; treat as "roughly this big", nothing more.
//   none   — no credible public figure exists. Do not invent one.
//
// SIZE is in miljarder kronor (mdr). Items with unknown size are null
// and the page pins them to the bottom.

export type TaxGapCategory =
  | 'esv_covered' // already in our get_skatteutgifter dataset
  | 'esv_uncovered' // listed in ESV bilaga but not yet ingested
  | 'reclassified' // previously ESV, now excluded from the bilaga
  | 'abolished' // tax Sweden abolished — not a skatteutgift at all
  | 'corporate_mechanism' // deferral / loss carryforward / special corp regimes
  | 'loophole' // base erosion / unquantified by design
  | 'other';

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface TaxGapItem {
  id: string;
  name_sv: string;
  /** miljarder kronor per year. null = no credible figure. */
  size_mdr: number | null;
  year_of_estimate: number | null;
  category: TaxGapCategory;
  source: string;
  confidence: Confidence;
  /** True if currently backed by data in fact_skatteutgift. */
  in_dataset: boolean;
  notes_sv: string;
}

export const TAX_GAP_ITEMS: TaxGapItem[] = [
  // --- Largest: already covered ---
  {
    id: 'JOBBSKATTE',
    name_sv: 'Jobbskatteavdrag',
    size_mdr: 175,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98 (utfall)',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Sveriges enskilt största skatteutgift. Ökat från ~141 mdr 2022.',
  },
  {
    id: 'RANTEAVDRAG',
    name_sv: 'Ränteavdrag bostadslån (skattereduktion för underskott av kapital)',
    size_mdr: 61,
    year_of_estimate: 2024,
    category: 'reclassified',
    source: 'ESV-beräkning på SCB hushållsdata, via SVT 2024-12-28',
    confidence: 'high',
    in_dataset: true,
    notes_sv:
      'Regeringen reklassificerade 2024/25: 30 % är nu "normskattesatsen" så det räknas INTE längre som skatteutgift. Endast 21 %-cap över 100k syns i bilagan som C17 (negativ). Vi har 2020/2023/2024.',
  },
  {
    id: 'GRUNDAVDRAG',
    name_sv: 'Förhöjt grundavdrag pensionärer',
    size_mdr: 56,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Skattesänkning för personer ≥66 år.',
  },
  {
    id: 'MOMS_LIVS',
    name_sv: 'Reducerad moms på livsmedel och restaurang (12 %)',
    size_mdr: 42,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Skillnad mot normalmoms 25 %.',
  },

  // --- Large reviewed items with mixed coverage status ---
  {
    id: 'FASTIGHETSSKATT_AVSKAFFAD',
    name_sv: 'Avskaffad fastighetsskatt (−2008)',
    size_mdr: 28,
    year_of_estimate: 2024,
    category: 'abolished',
    source:
      'Finanspolitiska rådet + SNS Konjunkturrådet (uppskattat bortfall vid 1 % av taxeringsvärde idag)',
    confidence: 'medium',
    in_dataset: false,
    notes_sv:
      'Före 2008 var fastighetsskatten 1 % av taxeringsvärdet. Den ersattes av en kapad kommunal fastighetsavgift på ~9 tkr/år. Om gamla regler gällt idag hade intäkten varit ~35 mdr — ersattes med ~7 mdr. Nettoeffekt: regressiv bostadsrelaterad skatterabatt.',
  },
  {
    id: 'AVKASTNING_EGET_HEM',
    name_sv: 'Avkastning eget hem (imputerad hyra obeskattad)',
    size_mdr: 28.7,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98 skatteutgift C1',
    confidence: 'high',
    in_dataset: true,
    notes_sv:
      'Finns i bilagan och är nu ingesterad i datasetet som skatteutgift C1. Den direkta avkastningen av att bo i egen bostad beskattas inte som kapitalinkomst trots att det borde enligt normen.',
  },
  {
    id: 'ENERGI_IND',
    name_sv: 'Energiskattenedsättning industri',
    size_mdr: 17,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Lägre energiskatt för tillverkningsindustri.',
  },
  {
    id: 'REGEL_3_12',
    name_sv: '3:12-reglerna (fåmansbolag)',
    size_mdr: 12.9,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98 skatteutgift C4; RiR 2021:17',
    confidence: 'high',
    in_dataset: true,
    notes_sv:
      'Det finns en officiell skatteutgift i bilagan för kapitalvinstbeskattning på kvalificerade andelar (C4), som i praktiken hänger ihop med 3:12-reglerna. Den har nu ingesterats och visas på sajten som 3:12-relaterad post.',
  },
  {
    id: 'ROT',
    name_sv: 'ROT-avdrag',
    size_mdr: 12,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Skattereduktion för reparation/ombyggnad/tillbyggnad.',
  },
  {
    id: 'KAPITALVINST_BOSTAD',
    name_sv: 'Nedsatt kapitalvinstskatt bostadsförsäljning + uppskov',
    size_mdr: 9.8,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98 skatteutgifter C6 + C7',
    confidence: 'high',
    in_dataset: true,
    notes_sv:
      'Kapitalvinst vid bostadsförsäljning beskattas 22 % i stället för 30 %, plus möjlighet att skjuta upp skatten. I datasetet finns detta nu som två separata poster: C7 och C6.',
  },
  {
    id: 'RUT',
    name_sv: 'RUT-avdrag',
    size_mdr: 8.2,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Skattereduktion för hushållsnära tjänster.',
  },
  {
    id: 'RESEAVDRAG',
    name_sv: 'Reseavdrag (resor till/från arbetet)',
    size_mdr: 7.3,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Ökade kraftigt 2023 pga bränslepriser.',
  },
  {
    id: 'FORMOGENHET_AVSKAFFAD',
    name_sv: 'Avskaffad förmögenhetsskatt (−2007)',
    size_mdr: 7,
    year_of_estimate: 2024,
    category: 'abolished',
    source: 'Finansdepartementet historiska siffror + SCB förmögenhetsdata (uppräknat)',
    confidence: 'medium',
    in_dataset: false,
    notes_sv:
      'Gav ~5 mdr 2006 vid avskaffandet. Med dagens förmögenheter skulle motsvarande skatt ge 7-10 mdr. Beror starkt på tröskel och sats.',
  },
  {
    id: 'MOMS_KULTUR',
    name_sv: 'Reducerad moms kultur/idrott/böcker (6 %)',
    size_mdr: 6,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: '6 % moms på böcker, tidningar, kultur, idrott.',
  },
  {
    id: 'SJOFART_TONNAGE',
    name_sv: 'Tonnagebeskattning sjöfart',
    size_mdr: 3,
    year_of_estimate: 2023,
    category: 'corporate_mechanism',
    source: 'ESV skr. 2024/25:98 + Trafikanalys',
    confidence: 'low',
    in_dataset: false,
    notes_sv:
      'Rederier betalar tonnageskatt (schablon baserad på fartygsstorlek) istället för bolagsskatt. Finns i bilagan under "Nedsatt inkomstskatt rederier".',
  },
  {
    id: 'ARVSSKATT_AVSKAFFAD',
    name_sv: 'Avskaffad arvsskatt (−2004)',
    size_mdr: 3.5,
    year_of_estimate: 2024,
    category: 'abolished',
    source: 'Finansdepartementet historiska siffror (uppräknat)',
    confidence: 'medium',
    in_dataset: false,
    notes_sv:
      'Gav ~2.5 mdr 2004. Uppräknat till 2024 med BNP och förmögenheter: ~3-4 mdr. Politiskt låst, inte föreslagen av något riksdagsparti 2025.',
  },
  {
    id: 'PERIODISERINGSFOND',
    name_sv: 'Periodiseringsfonder företag',
    size_mdr: 2.5,
    year_of_estimate: 2023,
    category: 'corporate_mechanism',
    source: 'Skatteverket statistik',
    confidence: 'low',
    in_dataset: false,
    notes_sv:
      'Företag får skjuta upp skatt på 25 % av vinsten i upp till 6 år. Nuvärdesförlust för staten ~2-3 mdr/år. Inte en skatteutgift enligt ESV, snarare tidsförskjutning.',
  },
  {
    id: 'FOU_AVDRAG',
    name_sv: 'FoU-avdrag arbetsgivaravgifter',
    size_mdr: 2,
    year_of_estimate: 2024,
    category: 'esv_uncovered',
    source: 'ESV skr. 2024/25:98 + Skatteverket',
    confidence: 'medium',
    in_dataset: false,
    notes_sv:
      'Nedsättning av arbetsgivaravgifter för forskning och utveckling. Finns i bilagan.',
  },
  {
    id: 'JORDBRUK_DIESEL',
    name_sv: 'Energiskattenedsättning jordbruk (diesel)',
    size_mdr: 1.5,
    year_of_estimate: 2024,
    category: 'esv_uncovered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: false,
    notes_sv: 'Återbetalning av energiskatt på diesel till jordbruksnäring.',
  },
  {
    id: 'EXPERT',
    name_sv: 'Expertskatt',
    size_mdr: 1,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: '25 % skattefrihet för utländska nyckelpersoner i 7 år.',
  },
  {
    id: 'VAXA_STODET',
    name_sv: 'Växa-stödet (nedsatt arbetsgivaravgift unga företag)',
    size_mdr: 0.6,
    year_of_estimate: 2024,
    category: 'esv_uncovered',
    source: 'Skatteverket + Tillväxtverket',
    confidence: 'medium',
    in_dataset: false,
    notes_sv:
      'Första anställda i småföretag får nedsatt arbetsgivaravgift första 24 mån.',
  },
  {
    id: 'GAVO',
    name_sv: 'Gåvoskattereduktion (till godkända mottagare)',
    size_mdr: 0.54,
    year_of_estimate: 2024,
    category: 'esv_covered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: true,
    notes_sv: 'Skattereduktion på upp till 3000 kr för gåvor till godkända organisationer.',
  },
  {
    id: 'INVESTERARAVDRAG',
    name_sv: 'Investeraravdrag',
    size_mdr: 0.3,
    year_of_estimate: 2023,
    category: 'esv_uncovered',
    source: 'ESV skr. 2024/25:98',
    confidence: 'high',
    in_dataset: false,
    notes_sv: 'Skattereduktion för investering i mindre bolag.',
  },
  {
    id: 'GAVOSKATT_AVSKAFFAD',
    name_sv: 'Avskaffad gåvoskatt (−2004)',
    size_mdr: 0.1,
    year_of_estimate: 2024,
    category: 'abolished',
    source: 'Historisk finansdepartementsdata',
    confidence: 'low',
    in_dataset: false,
    notes_sv:
      'Försumbart bortfall — gåvoskatten gav mycket lite när den avskaffades. Ingår här för fullständighet.',
  },

  // --- Unquantified loopholes ---
  {
    id: 'UNDERSKOTTSAVDRAG',
    name_sv: 'Underskottsavdrag företag (loss carryforwards)',
    size_mdr: null,
    year_of_estimate: null,
    category: 'corporate_mechanism',
    source: 'Skatteverket (ej publicerad separat siffra)',
    confidence: 'none',
    in_dataset: false,
    notes_sv:
      'Företag får rulla förluster framåt obegränsat i tid. Aldrig separat kvantifierat som skattebortfall — det är en tidsförskjutning, inte ett avdrag. Stor effekt för stora koncerner.',
  },
  {
    id: 'CARRIED_INTEREST',
    name_sv: 'Carried interest (PE/VC-förvaltare)',
    size_mdr: null,
    year_of_estimate: null,
    category: 'loophole',
    source: 'SKV rättspraxis + ekonomdebatt',
    confidence: 'none',
    in_dataset: false,
    notes_sv:
      'Förvaltningsarvode som beskattas som kapitalinkomst (20-30 %) istället för tjänsteinkomst (52-57 %). Aldrig officiellt kvantifierat men uppskattningar i debatt: 0.5-2 mdr/år.',
  },
  {
    id: 'INTERNPRISSATTNING',
    name_sv: 'Internprissättning multinationella koncerner',
    size_mdr: null,
    year_of_estimate: null,
    category: 'loophole',
    source: 'OECD BEPS + Skatteverket transfer pricing enhet',
    confidence: 'none',
    in_dataset: false,
    notes_sv:
      'Vinster flyttas till lågskatteländer via koncerninterna priser. OECD uppskattar globalt bortfall till 100-240 mdr USD/år. Svensk andel är okänd — gissningar 5-15 mdr/år.',
  },
  {
    id: 'HOLDINGSTRUKTUR',
    name_sv: 'Holdingbolagsstrukturer för utdelning',
    size_mdr: null,
    year_of_estimate: null,
    category: 'loophole',
    source: 'Panama/Paradise Papers + Skatteverket',
    confidence: 'none',
    in_dataset: false,
    notes_sv:
      'Utdelning routad via holdingbolag i NL/LUX/CY för att undvika svensk kupongskatt. Aldrig kvantifierat.',
  },
  {
    id: 'RANTESNURROR',
    name_sv: 'Räntesnurror (koncerninterna lån)',
    size_mdr: null,
    year_of_estimate: null,
    category: 'loophole',
    source: 'SKV + ränteavdragsbegränsningsreglerna 2009/2013/2019',
    confidence: 'none',
    in_dataset: false,
    notes_sv:
      'Delvis stoppat av EBITDA-regeln 2019 (30 % cap) men fortfarande en viss exponering. Aldrig publicerat.',
  },
];

/** Sort helper: biggest known amounts first, unknowns pinned to bottom. */
export function sortBySize(items: TaxGapItem[]): TaxGapItem[] {
  return [...items].sort((a, b) => {
    if (a.size_mdr == null && b.size_mdr == null) return 0;
    if (a.size_mdr == null) return 1;
    if (b.size_mdr == null) return -1;
    return b.size_mdr - a.size_mdr;
  });
}

export const CATEGORY_LABELS: Record<TaxGapCategory, string> = {
  esv_covered: 'ESV — finns i vårt dataset',
  esv_uncovered: 'ESV — ej ingesterad',
  reclassified: 'Reklassificerad ut ur bilagan',
  abolished: 'Avskaffad skatt',
  corporate_mechanism: 'Företagsmekanism',
  loophole: 'Kryphål / ej kvantifierat',
  other: 'Övrigt',
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'Hög',
  medium: 'Medel',
  low: 'Låg',
  none: 'Ingen',
};
