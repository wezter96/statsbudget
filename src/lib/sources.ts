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
    datasetUrl: 'https://www.statskontoret.se/psidata/arsutfall/',
    description:
      'Statens årsutfall per utgiftsområde och anslag 1997–2025. Öppna data (CC0), uppdateras halvårsvis.',
    fields: ['Utfall per utgiftsområde', 'Utfall per anslag', 'Statens budget'],
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
    id: 'riksdagen',
    name: 'Sveriges riksdag',
    shortName: 'Riksdagen',
    url: 'https://www.riksdagen.se',
    datasetUrl: 'https://data.riksdagen.se',
    description:
      'Budgetpropositioner, finansutskottets betänkanden och partiernas motioner — används för historiska snapshots, årsspecifik validering och skuggbudgetar.',
    fields: ['Budgetpropositioner', 'Finansutskottets betänkanden', 'Motioner med alternativa förslag'],
  },
];

/** Map shortName → anchor slug on /about#datakallor. */
export function sourceAnchor(shortName: string): string {
  const match = SOURCES.find((s) => s.shortName === shortName || s.name === shortName);
  return match ? `/about#kalla-${match.id}` : '/about#datakallor';
}
