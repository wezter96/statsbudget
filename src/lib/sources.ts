/**
 * Central registry of every external data source Statsbudget pulls from.
 * Surfaced on /about#datakallor. Chart captions link back here.
 */

export interface DataSource {
  id: string;
  name: string;
  shortName: string;
  url: string;
  description: string;
  /** What gets pulled from this source. */
  fields: string[];
  /** Deep-link to the specific dataset we actually use (optional). */
  datasetUrl?: string;
}

export const SOURCES: DataSource[] = [
  {
    id: 'esv',
    name: 'Ekonomistyrningsverket',
    shortName: 'ESV',
    url: 'https://www.esv.se',
    datasetUrl: 'https://www.statskontoret.se/psidata/',
    description:
      'Statskontorets öppna budgetdata från Hermes: årsutfall per utgiftsområde och anslag samt månadsutfall för statens inkomster och utgifter.',
    fields: [
      'Årsutfall per utgiftsområde',
      'Årsutfall per anslag',
      'Årsutfall inkomster',
      'Månadsutfall inkomster',
      'Statens budget',
    ],
  },
  {
    id: 'scb-cpi',
    name: 'Statistiska centralbyrån — KPI',
    shortName: 'SCB (KPI)',
    url: 'https://www.scb.se',
    datasetUrl:
      'https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__PR__PR0101__PR0101A/KPIFastAr/',
    description:
      'Konsumentprisindex (KPI) fastställda årsmedeltal, 1980=100. Används för inflationsjustering till reala kronor.',
    fields: ['KPI årsmedeltal 1980–2025'],
  },
  {
    id: 'scb-gdp',
    name: 'Statistiska centralbyrån — BNP',
    shortName: 'SCB (BNP)',
    url: 'https://www.scb.se',
    datasetUrl:
      'https://www.statistikdatabasen.scb.se/pxweb/sv/ssd/START__NR__NR0103__NR0103B/NR0103ENS2010T01Kv/',
    description:
      'BNP till marknadspris, löpande priser (Mkr). Används för att visa utgifter som andel av BNP.',
    fields: ['Nominell BNP per år'],
  },
  {
    id: 'eurostat',
    name: 'Eurostat — Government finance statistics',
    shortName: 'Eurostat',
    url: 'https://ec.europa.eu/eurostat',
    datasetUrl:
      'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/gov_10a_exp',
    description:
      'Offentliga utgifter för Sverige enligt COFOG. Används både för den konsoliderade översiktsvyn av hela offentliga sektorn (S13) och för separata delsektorsvyer av staten, kommuner/regioner och socialförsäkringsfonder.',
    fields: [
      'COFOG-funktioner GF01–GF10',
      'Konsoliderad offentlig sektor (S13)',
      'Delsektorer S1311, S1313 och S1314',
      '1990–2024',
    ],
  },
  {
    id: 'riksdagen',
    name: 'Sveriges riksdag',
    shortName: 'Riksdagen',
    url: 'https://www.riksdagen.se',
    datasetUrl: 'https://data.riksdagen.se',
    description:
      'Budgetpropositioner, finansutskottets betänkanden och partiernas motioner — används för historiska snapshots, årsspecifik validering och skuggbudgetar.',
    fields: ['Budgetpropositioner', 'Finansutskottets betänkanden', 'Motioner med alternativa förslag'],
  },
  {
    id: 'riksrevisionen',
    name: 'Riksrevisionen',
    shortName: 'Riksrevisionen',
    url: 'https://www.riksrevisionen.se',
    description:
      'Oberoende granskningsmyndighet under riksdagen. Rapporter om effektiviteten i skatteutgifter — självfinansieringsgrad, dödviktseffekter och fördelningsanalys för ROT, RUT, ISK, jobbskatteavdrag m.fl. Används som källa i den skattepolitiska tidslinjen.',
    fields: [
      'RIR 2023:26 — ROT (14 % självfinansiering)',
      'RIR 2020:2 — RUT (svagt stöd för självfinansiering)',
      'RIR 2018:19 — ISK (23 mdr skattebortfall 2012–2017)',
      'RIR 2019:7 — Jobbskatteavdraget',
      'RIR 2017:5 — 3:12-reglerna',
    ],
  },
  {
    id: 'regeringen',
    name: 'Regeringskansliet — Skatteutgiftsbilagan',
    shortName: 'Regeringen',
    url: 'https://www.regeringen.se',
    description:
      'Regeringens årliga skrivelse "Redovisning av skatteutgifter" (skr. 20XX/XX:98). Listar ~160 poster som avviker från normskattesystemet. Vi använder de ~12 största posterna med kvantifierade belopp. Källa för JOBBSKATTE, MOMS_LIVS, GRUNDAVDRAG, ROT, RUT m.fl.',
    fields: ['Skatteutgifter per post (Mkr)', 'Utfall + prognoser'],
  },
  {
    id: 'ekonomifakta',
    name: 'Ekonomifakta',
    shortName: 'Ekonomifakta',
    url: 'https://www.ekonomifakta.se',
    description:
      'Statistik och visualiseringar om svensk ekonomi. Används som kompletterande källa för budgetbalans per regering.',
    fields: ['Budgetbalans per regeringsperiod'],
  },
];

/** Map shortName → anchor slug on /about#datakallor. */
export function sourceAnchor(shortName: string): string {
  const match = SOURCES.find((s) => s.shortName === shortName || s.name === shortName);
  return match ? `/about#kalla-${match.id}` : '/about#datakallor';
}
