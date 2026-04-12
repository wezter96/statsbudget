// Major Swedish tax policy milestones 1970–2026 that significantly
// affected state revenue — positive or negative.
//
// Static data, no DB dependency. Rendered on /historical.
// Sources: Riksdagen, Finansdepartementet, ESV, Riksrevisionen, SOU-utredningar.

export type ImpactDirection = 'positive' | 'negative' | 'structural' | 'mixed';

export type TaxCategory =
  | 'income_tax'
  | 'capital_tax'
  | 'property_tax'
  | 'vat'
  | 'corporate_tax'
  | 'deduction'
  | 'other';

export interface TimelineEvent {
  year: number;
  title_sv: string;
  title_en: string;
  description_sv: string;
  description_en: string;
  impact: ImpactDirection;
  /** Rough annual revenue impact in miljarder kronor (today's terms). */
  estimated_impact_mdr: number | null;
  category: TaxCategory;
  /** URL to authoritative source (Riksrevisionen, SOU, etc). */
  source_url?: string;
  /** Short citation label, e.g. "RIR 2018:19". */
  source_label?: string;
}

export const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    year: 1971,
    title_sv: 'Individuell beskattning införs',
    title_en: 'Individual taxation introduced',
    description_sv:
      'Sambeskattning avskaffas. Varje person beskattas för sin egen inkomst. Banade väg för kvinnors inträde på arbetsmarknaden och bredare skattebas.',
    description_en:
      'Joint spousal taxation abolished. Each individual taxed on their own income. Paved the way for women entering the labour market and a broader tax base.',
    impact: 'positive',
    estimated_impact_mdr: null,
    category: 'income_tax',
  },
  {
    year: 1972,
    title_sv: 'Moms (mervärdesskatt) införs',
    title_en: 'VAT (value-added tax) introduced',
    description_sv:
      'Sverige ersätter omsättningsskatten (OMS) med mervärdesskatt — en genomgripande konsumtionsskattereform som breddade skattebasen kraftigt. Initialt 17,65 %.',
    description_en:
      'Sweden replaces the old cascading sales tax (OMS) with a modern value-added tax — a sweeping reform that greatly broadened the tax base. Initially 17.65%.',
    impact: 'positive',
    estimated_impact_mdr: null,
    category: 'vat',
  },
  {
    year: 1985,
    title_sv: 'ROT-avdrag införs första gången',
    title_en: 'ROT tax credit introduced (first time)',
    description_sv:
      'Skattereduktion för renovering och ombyggnad av bostäder. Tillfälligt — avskaffades sedan och återinfördes 2009.',
    description_en:
      'Tax credit for home repair and renovation. Temporary — later abolished and reintroduced in 2009.',
    impact: 'negative',
    estimated_impact_mdr: 2,
    category: 'deduction',
  },
  {
    year: 1990,
    title_sv: 'Århundradets skattereform',
    title_en: 'The "Tax reform of the century"',
    description_sv:
      'Sveriges största skattereform. Marginalskatter sänktes kraftigt (från 72 % → ~50 %), kapitalinkomster fick platt 30 % skatt, och skattebasen breddades. Designad som intäktsneutral men förändrade strukturen i grunden.',
    description_en:
      'Sweden\'s largest tax reform. Marginal rates dropped sharply (72% → ~50%), capital income taxed at flat 30%, and the tax base was broadened. Designed as revenue-neutral but fundamentally restructured the system.',
    impact: 'structural',
    estimated_impact_mdr: null,
    category: 'income_tax',
  },
  {
    year: 1991,
    title_sv: 'Moms höjs till 25 %',
    title_en: 'VAT raised to 25%',
    description_sv:
      'Mervärdeskatten höjs från 23,46 % till 25 % som del av skattereformen. Fortfarande Sveriges normalsats.',
    description_en:
      'VAT raised from 23.46% to 25% as part of the tax reform. Still Sweden\'s standard rate today.',
    impact: 'positive',
    estimated_impact_mdr: 15,
    category: 'vat',
  },
  {
    year: 1993,
    title_sv: 'Ränteavdrag begränsas till 30 %',
    title_en: 'Interest deduction limited to 30%',
    description_sv:
      'Skattereduktionen för ränteutgifter sänks från 50 % till 30 %, med ytterligare begränsning till 21 % ovanför 100 000 kr. Minskade avdragets kostnad kraftigt.',
    description_en:
      'Tax reduction for interest expenses cut from 50% to 30%, with a further limit of 21% above SEK 100k. Sharply reduced the deduction\'s cost.',
    impact: 'positive',
    estimated_impact_mdr: 20,
    category: 'deduction',
  },
  {
    year: 1995,
    title_sv: 'EU-inträde',
    title_en: 'EU accession',
    description_sv:
      'EU-medlemskap innebar viss momsharmonisering och nya regler kring punktskatter, men de stora skattestrukturerna var redan anpassade.',
    description_en:
      'EU membership brought some VAT harmonization and new excise rules, but major tax structures were already aligned.',
    impact: 'structural',
    estimated_impact_mdr: null,
    category: 'vat',
  },
  {
    year: 1996,
    title_sv: 'Reducerad moms på livsmedel (12 %)',
    title_en: 'Reduced VAT on food (12%)',
    description_sv:
      'Momsen på livsmedel sänks från 21 % till 12 %. Kostar idag ~42 mdr/år i uteblivna intäkter jämfört med normalsatsen 25 %. En av de största enskilda skatteutgifterna.',
    description_en:
      'VAT on food reduced from 21% to 12%. Costs ~42 billion/year today in foregone revenue compared to the 25% standard rate. One of the largest single tax expenditures.',
    impact: 'negative',
    estimated_impact_mdr: 42,
    category: 'vat',
  },
  {
    year: 2002,
    title_sv: 'Förhöjt grundavdrag för pensionärer',
    title_en: 'Enhanced basic allowance for pensioners',
    description_sv:
      'Grundavdraget höjs kraftigt för personer ≥65 år. Utökas successivt i flera steg — kostar idag ~56 mdr/år, den tredje största skatteutgiften.',
    description_en:
      'Basic tax allowance raised sharply for people aged 65+. Expanded in several steps — costs ~56 billion/year today, the third-largest tax expenditure.',
    impact: 'negative',
    estimated_impact_mdr: 56,
    category: 'income_tax',
  },
  {
    year: 2004,
    title_sv: 'Arvs- och gåvoskatt avskaffas',
    title_en: 'Inheritance and gift tax abolished',
    description_sv:
      'Arvsskatten (sedan 1884) och gåvoskatten avskaffas med bred politisk majoritet. Kostade staten ca 3–4 mdr/år i uteblivna intäkter.',
    description_en:
      'The inheritance tax (in place since 1884) and gift tax abolished with broad political support. Cost the state ~3–4 billion SEK/year in foregone revenue.',
    impact: 'negative',
    estimated_impact_mdr: 4,
    category: 'property_tax',
  },
  {
    year: 2007,
    title_sv: 'Jobbskatteavdrag steg 1',
    title_en: 'Earned income tax credit (step 1)',
    description_sv:
      'Alliansregeringen inför jobbskatteavdraget — idag Sveriges enskilt största skatteutgift (~175 mdr/år). Syftet var att öka skillnaden mellan arbete och bidrag.',
    description_en:
      'The Alliance government introduced the earned income tax credit — today Sweden\'s single largest tax expenditure (~175 billion/year). Aimed to increase the difference between working and receiving benefits.',
    impact: 'negative',
    estimated_impact_mdr: 45,
    category: 'income_tax',
    source_url: 'https://www.riksrevisionen.se/rapporter/granskningsrapporter/2019/jobbskatteavdraget.html',
    source_label: 'RIR 2019:7',
  },
  {
    year: 2007,
    title_sv: 'Förmögenhetsskatten avskaffas',
    title_en: 'Wealth tax abolished',
    description_sv:
      'Förmögenhetsskatten (införd 1947) avskaffas. Gav ca 5 mdr/år vid avskaffandet — med dagens förmögenheter uppskattad till 7–10 mdr/år i uteblivna intäkter.',
    description_en:
      'The wealth tax (in place since 1947) abolished. Yielded ~5 billion/year at abolition — with today\'s wealth levels estimated at 7–10 billion/year in foregone revenue.',
    impact: 'negative',
    estimated_impact_mdr: 7,
    category: 'capital_tax',
  },
  {
    year: 2007,
    title_sv: 'RUT-avdrag införs',
    title_en: 'RUT household services credit introduced',
    description_sv:
      'Skattereduktion för hushållsnära tjänster (städ, trädgård, barnpassning). Direkt kostnad 4,6 mdr/år (2017). Regeringen hävdade självfinansiering, men Riksrevisionen (2020) fann svagt empiriskt stöd. Regeringens antagande om svart→vitt-omvandling var 23× högre än Skatteverkets mätningar. Andelen frigjord tid som gick till marknadsarbete var ~25 %, inte 50 % som regeringen antog. Svarta sektorn för hushållstjänster uppskattades till 780 mkr av SKV — inte 3 mdr som Finansdepartementet använde.',
    description_en:
      'Tax credit for household services (cleaning, gardening, childcare). Direct cost 4.6 billion/year (2017). The government claimed self-financing, but the Swedish NAO (2020) found weak empirical support. The government\'s assumed black-to-white conversion was 23× higher than the Tax Agency\'s measurements. The share of freed time going to market work was ~25%, not 50% as assumed. The undeclared household services sector was estimated at SEK 780 million by the Tax Agency — not 3 billion as assumed by the Finance Ministry.',
    impact: 'negative',
    estimated_impact_mdr: 8,
    category: 'deduction',
    source_url: 'https://www.riksrevisionen.se/download/18.2008b69c18bd0f6ed3f29586/1581941851838/RiR%202020_02%20Anpassad.pdf',
    source_label: 'RIR 2020:2',
  },
  {
    year: 2008,
    title_sv: 'Fastighetsskatten avskaffas',
    title_en: 'Property tax abolished',
    description_sv:
      'Statlig fastighetsskatt (1 % av taxeringsvärde) ersätts med kapad kommunal fastighetsavgift (~6 000 kr/år). Bortfall idag uppskattad till ~28 mdr/år. Starkt regressiv effekt.',
    description_en:
      'State property tax (1% of assessed value) replaced with a capped municipal fee (~SEK 6,000/year). Foregone revenue estimated at ~28 billion/year today. Strongly regressive effect.',
    impact: 'negative',
    estimated_impact_mdr: 28,
    category: 'property_tax',
  },
  {
    year: 2009,
    title_sv: 'ROT-avdrag återinförs permanent',
    title_en: 'ROT credit reintroduced permanently',
    description_sv:
      'ROT-avdraget permanentas efter att ha varit tillfälligt sedan 1985. Kostar idag ~12 mdr/år. Riksrevisionen (2023) beräknar självfinansieringsgraden till 14 % — av 9,8 mdr i bruttokostnad genereras bara 1,4 mdr i ökade skatteintäkter (nettokostnad 8,4 mdr). Hushållens efterfrågan på svarta tjänster har minskat, men svarta löner bortom konsumentledet har ökat. Huvuddelen av rottjänsterna hade köpts även utan avdrag.',
    description_en:
      'ROT credit made permanent after being temporary since 1985. Costs ~12 billion/year. The Swedish NAO (2023) calculates the self-financing rate at 14% — of 9.8 billion in gross cost, only 1.4 billion is recouped in increased tax revenue (net cost 8.4 billion). Household demand for undeclared services has fallen, but undeclared wages further down the supply chain have increased. Most ROT services would have been purchased without the credit.',
    impact: 'negative',
    estimated_impact_mdr: 12,
    category: 'deduction',
    source_url: 'https://www.riksrevisionen.se/download/18.e6f1d6318fa4a7c94deb47/1716897989008/RiR_2023_26_rapport.pdf',
    source_label: 'RIR 2023:26',
  },
  {
    year: 2009,
    title_sv: '3:12-reglerna utvidgas kraftigt',
    title_en: 'Close company rules (3:12) significantly expanded',
    description_sv:
      'Fåmansbolagsreglerna reformeras — fler ägare kan ta utdelning till 20 % skatt istället för tjänsteinkomstskatt (52–57 %). Uppskattat bortfall ~13 mdr/år. Riksrevisionen konstaterade att reglerna blivit en skatteplaneringsventil.',
    description_en:
      'Close company rules reformed — more owners can take dividends at 20% tax instead of employment income tax (52–57%). Estimated foregone revenue ~13 billion/year. The Swedish NAO found the rules had become a tax planning valve.',
    impact: 'negative',
    estimated_impact_mdr: 13,
    category: 'corporate_tax',
    source_url: 'https://www.riksrevisionen.se/rapporter/granskningsrapporter/2017/3-12-reglerna.html',
    source_label: 'RIR 2017:5',
  },
  {
    year: 2009,
    title_sv: 'Bolagsskatten sänks till 26,3 %',
    title_en: 'Corporate tax cut to 26.3%',
    description_sv:
      'Bolagsskatten sänks från 28 % till 26,3 % — första steget i en lång sänkningstrend. Under 1990 låg den på 50 %; 1991 sänktes den till 30 %, sedan vidare. Sänktes ytterligare till 22 % (2013) och till 20,6 % (2019).',
    description_en:
      'Corporate tax cut from 28% to 26.3% — first step in a long downward trend. In 1990 it was 50%; cut to 30% in 1991, then further. Later reduced to 22% (2013) and 20.6% (2019).',
    impact: 'negative',
    estimated_impact_mdr: 16,
    category: 'corporate_tax',
  },
  {
    year: 2012,
    title_sv: 'Restaurangmoms sänks till 12 %',
    title_en: 'Restaurant VAT cut to 12%',
    description_sv:
      'Momsen på restaurang- och cateringtjänster sänks från 25 % till 12 %. Uteblivna intäkter ~7 mdr/år. Ingår i den sammanlagda "reducerad moms livsmedel"-posten.',
    description_en:
      'VAT on restaurant and catering services cut from 25% to 12%. Foregone revenue ~7 billion/year. Part of the combined "reduced food VAT" expenditure item.',
    impact: 'negative',
    estimated_impact_mdr: 7,
    category: 'vat',
  },
  {
    year: 2012,
    title_sv: 'ISK (investeringssparkonto) införs',
    title_en: 'ISK investment savings account introduced',
    description_sv:
      'Schablonbeskattning av aktie-/fondinnehav ersätter realisationsbeskattning. Riksrevisionen beräknar skattebortfallet till 23 mdr för perioden 2012–2017 (~4 mdr/år), plus 19 mdr i framtida bortfall från orealiserade vinster. Med 2,2 miljoner kontohavare och 707 mdr i kapitalunderlag (2017) — idag sannolikt 2 000+ mdr — är den årliga effekten betydligt större.',
    description_en:
      'Flat-rate taxation of securities replaces realisation-based taxation. The Swedish NAO estimates the tax revenue loss at 23 billion for 2012–2017 (~4 billion/year), plus 19 billion in future losses from unrealised gains. With 2.2 million account holders and 707 billion in assets (2017) — today likely 2,000+ billion — the annual effect is considerably larger.',
    impact: 'negative',
    estimated_impact_mdr: 7,
    category: 'capital_tax',
    source_url: 'https://www.riksrevisionen.se/download/18.2008b69c18bd0f6ed3f290e7/1529913565227/RiR_2018_19_ANPASSAD.pdf',
    source_label: 'RIR 2018:19',
  },
  {
    year: 2016,
    title_sv: 'Jobbskatteavdrag steg 5 — total kostnad ~140 mdr',
    title_en: 'Earned income credit step 5 — total cost ~140 billion',
    description_sv:
      'Femte steget av jobbskatteavdraget. Total årlig skattesubvention passerar 140 mdr kronor — mer än hela försvarsbudgeten.',
    description_en:
      'Fifth step of the earned income credit. Total annual tax expenditure exceeds SEK 140 billion — more than the entire defence budget.',
    impact: 'negative',
    estimated_impact_mdr: 140,
    category: 'income_tax',
  },
  {
    year: 2019,
    title_sv: 'EBITDA-baserad ränteavdragsbegränsning',
    title_en: 'EBITDA-based interest deduction cap',
    description_sv:
      'Koncerners ränteavdrag begränsas till 30 % av EBITDA. Tredje steget mot att stänga räntesnurror — delvis effektiv.',
    description_en:
      'Corporate interest deductions capped at 30% of EBITDA. Third step toward closing interest deduction loopholes — partially effective.',
    impact: 'positive',
    estimated_impact_mdr: 5,
    category: 'corporate_tax',
  },
  {
    year: 2020,
    title_sv: 'ROT höjs till 50 000 kr, RUT till 75 000 kr',
    title_en: 'ROT raised to SEK 50k, RUT to SEK 75k',
    description_sv:
      'Taken för ROT- och RUT-avdrag höjs som konjunkturstimulans under pandemin.',
    description_en:
      'ROT and RUT credit ceilings raised as fiscal stimulus during the pandemic.',
    impact: 'negative',
    estimated_impact_mdr: 3,
    category: 'deduction',
  },
  {
    year: 2023,
    title_sv: 'Ränteuppgång — ränteavdrag når 51 mdr',
    title_en: 'Interest rate surge — mortgage deductions reach 51 billion',
    description_sv:
      'Riksbankens räntehöjningar (0 % → 4 %) slår igenom. Statens kostnad för ränteavdrag nästan fördubblas från 28 mdr (2020) till 51 mdr.',
    description_en:
      'Riksbank rate hikes (0% → 4%) feed through. The state\'s cost for interest deductions nearly doubles from 28 billion (2020) to 51 billion.',
    impact: 'negative',
    estimated_impact_mdr: 51,
    category: 'deduction',
  },
  {
    year: 2024,
    title_sv: 'Ränteavdrag all-time high 61 mdr — osynliggörs i redovisningen',
    title_en: 'Interest deductions at all-time high 61 billion — hidden from official accounts',
    description_sv:
      'Rekordkostnad 61 mdr — staten bär 30 % av hushållens räntekostnader. Samtidigt ändrar regeringen definitionen av "normskattesatsen" för kapital till 30 %, vilket innebär att ränteavdraget inte längre räknas som en skatteutgift i ESV:s officiella katalog. Avdraget och kostnaden är oförändrade — men posten försvinner ur den redovisning som riksdagen granskar.',
    description_en:
      'Record cost of 61 billion — the state covers 30% of household interest expenses. Simultaneously, the government redefines the "norm tax rate" for capital as 30%, meaning the mortgage deduction no longer counts as a tax expenditure in ESV\'s official catalog. The deduction and its cost are unchanged — but the item disappears from the accounts that parliament reviews.',
    impact: 'negative',
    estimated_impact_mdr: 61,
    category: 'deduction',
  },
];
