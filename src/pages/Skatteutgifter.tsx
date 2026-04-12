import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { TFunction } from 'i18next';
import Layout from '@/components/Layout';
import {
  getSkatteutgifter,
  getSkatteutgiftFacts,
  getSkatteutgiftTimeSeries,
  getYears,
} from '@/lib/budget-queries';

type ComparisonItem = {
  key: string;
  amount: string;
  amountNum: number;
  source?: string;
};

type ComparisonCategory = {
  catKey: 'rich' | 'poor' | 'migration';
  color: string;
  bgColor: string;
  borderColor: string;
  items: ComparisonItem[];
  total: string;
  totalNum: number;
};

const comparisonData: ComparisonCategory[] = [
  {
    catKey: 'rich',
    color: 'text-rose-700 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/30',
    borderColor: 'border-rose-200 dark:border-rose-900',
    total: '~146 mdr kr',
    totalNum: 146000,
    items: [
      { key: 'ranteavdrag', amount: '61 000 Mkr', amountNum: 61000, source: 'ESV, Skr. 2024/25:98' },
      { key: 'avkastningHem', amount: '28 690 Mkr', amountNum: 28690, source: 'Skr. 2024/25:98, post C1' },
      { key: 'tolvregler', amount: '12 910 Mkr', amountNum: 12910, source: 'Skr. 2024/25:98, post C4; RiR 2021:17' },
      { key: 'rot', amount: '12 320 Mkr', amountNum: 12320, source: 'Skr. 2024/25:98, post G4; SCB HEK' },
      { key: 'rut', amount: '8 200 Mkr', amountNum: 8200, source: 'Skr. 2024/25:98, post G3; Skatteverket' },
      { key: 'kapitalvinstBostad', amount: '7 300 Mkr', amountNum: 7300, source: 'Skr. 2024/25:98, post C7' },
      { key: 'avkastningBrf', amount: '6 430 Mkr', amountNum: 6430, source: 'Skr. 2024/25:98, post C2' },
      { key: 'miljobilar', amount: '4 710 Mkr', amountNum: 4710, source: 'Skr. 2024/25:98, post A15' },
      { key: 'uppskov', amount: '2 510 Mkr', amountNum: 2510, source: 'Skr. 2024/25:98, post C6' },
      { key: 'onoterade', amount: '2 020 Mkr', amountNum: 2020, source: 'Skr. 2024/25:98, post C3' },
    ],
  },
  {
    catKey: 'poor',
    color: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderColor: 'border-emerald-200 dark:border-emerald-900',
    total: '~47–52 mdr kr',
    totalNum: 50000,
    items: [
      { key: 'ekonomisktBistand', amount: '~15–16 mdr', amountNum: 15500, source: 'Socialstyrelsen, SoL kap 4 §1' },
      { key: 'bostadstillagg', amount: '~10–11 mdr', amountNum: 10500, source: 'Pensionsmyndigheten; SFB kap 101–103' },
      { key: 'aldreforsorjning', amount: '~8–9 mdr', amountNum: 8500, source: 'Pensionsmyndigheten; SFB kap 74' },
      { key: 'bostadsbidrag', amount: '~5–6 mdr', amountNum: 5500, source: 'Försäkringskassan; SFB kap 95–98' },
      { key: 'etablering', amount: '~5–7 mdr', amountNum: 6000, source: 'Arbetsförmedlingen; SFS 2017:584' },
      { key: 'underhallsstod', amount: '~3 mdr', amountNum: 3000, source: 'Försäkringskassan; SFB kap 17–19' },
    ],
  },
  {
    catKey: 'migration',
    color: 'text-sky-700 dark:text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-950/30',
    borderColor: 'border-sky-200 dark:border-sky-900',
    total: '~25–30 mdr kr',
    totalNum: 27500,
    items: [
      { key: 'uo8', amount: '~10–12 mdr', amountNum: 11000, source: 'Budgetpropositionen, UO 8' },
      { key: 'uo13', amount: '~15–18 mdr', amountNum: 16500, source: 'Budgetpropositionen, UO 13' },
    ],
  },
];

function ExpandableRow({ item, t }: { item: ComparisonItem; t: TFunction }) {
  const [open, setOpen] = useState(false);
  const name = t(`skatteutgifter.comparison.items.${item.key}.name`);
  const detail = t(`skatteutgifter.comparison.items.${item.key}.detail`);
  return (
    <>
      <tr
        className="border-t border-border cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 font-medium text-foreground">
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
            />
            {name}
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{item.amount}</td>
      </tr>
      {open && (
        <tr className="border-t border-border/50">
          <td colSpan={2} className="px-4 py-3 pl-10">
            <p className="text-sm text-muted-foreground leading-relaxed">{detail}</p>
            {item.source && (
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t('skatteutgifter.comparison.source')}: {item.source}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ComparisonSection() {
  const { t } = useTranslation();
  const totalRika = comparisonData[0].totalNum;
  const totalFattiga = comparisonData[1].totalNum;
  const totalMigration = comparisonData[2].totalNum;
  const max = Math.max(totalRika, totalFattiga, totalMigration);

  return (
    <section className="py-10 sm:py-14 border-t border-border">
      <div className="container max-w-5xl">
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          {t('skatteutgifter.comparison.heading')}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base max-w-3xl">
          {t('skatteutgifter.comparison.intro')}
        </p>

        <div className="mt-8 space-y-3">
          {comparisonData.map(cat => (
            <div key={cat.catKey} className="flex items-center gap-2 sm:gap-3">
              <div className="w-28 sm:w-64 text-right text-xs sm:text-sm truncate">
                <span className={cat.color + ' font-medium'}>{cat.total}</span>
              </div>
              <div className="flex-1">
                <div
                  className={`h-8 rounded ${cat.bgColor} ${cat.borderColor} border flex items-center px-2`}
                  style={{ width: `${Math.max((cat.totalNum / max) * 100, 8)}%` }}
                >
                  <span className={`text-xs font-medium truncate ${cat.color}`}>
                    {t(`skatteutgifter.comparison.cat.${cat.catKey}.barLabel`)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p
          className="mt-4 text-xs text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: t('skatteutgifter.comparison.ratio') }}
        />

        <div className="mt-10 space-y-8">
          {comparisonData.map(cat => (
            <div key={cat.catKey} className={`rounded-lg border ${cat.borderColor} overflow-hidden`}>
              <div className={`${cat.bgColor} px-4 py-3 flex items-baseline justify-between`}>
                <h3 className={`font-semibold text-sm sm:text-base ${cat.color}`}>
                  {t(`skatteutgifter.comparison.cat.${cat.catKey}.title`)}
                </h3>
                <span className={`text-sm font-semibold tabular-nums ${cat.color}`}>{cat.total}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('skatteutgifter.comparison.post')}</th>
                    <th className="px-4 py-2 font-medium text-right">{t('skatteutgifter.col.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map(item => (
                    <ExpandableRow key={item.key} item={item} t={t} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-muted-foreground space-y-1">
          <p>
            <strong>{t('skatteutgifter.comparison.noteTitle')}</strong> {t('skatteutgifter.comparison.note')}
          </p>
          <p>{t('skatteutgifter.comparison.dataNote')}</p>
        </div>
      </div>
    </section>
  );
}

const SkatteutgifterPage = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();

  const years = useQuery({ queryKey: ['years'], queryFn: getYears });
  const dim = useQuery({ queryKey: ['skatteutgifter-dim'], queryFn: getSkatteutgifter });
  const series = useQuery({
    queryKey: ['skatteutgifter-series'],
    queryFn: getSkatteutgiftTimeSeries,
  });

  const availableYears = (() => {
    if (!series.data) return [];
    const set = new Set<number>();
    for (const f of series.data) set.add(f.year_id);
    return Array.from(set).sort((a, b) => b - a);
  })();

  const defaultYear = availableYears[0] ?? years.data?.at(-1)?.year_id;
  const yearParam = params.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : defaultYear;

  const facts = useQuery({
    queryKey: ['skatteutgifter-facts', selectedYear],
    queryFn: () => (selectedYear ? getSkatteutgiftFacts(selectedYear) : Promise.resolve([])),
    enabled: selectedYear != null,
  });

  const isEnglish = i18n.language?.startsWith('en');

  const rows = (() => {
    if (!dim.data) return [];
    const factByCode = new Map<number, { amount_mkr: number; is_estimated: boolean }>();
    for (const f of facts.data ?? []) {
      factByCode.set(f.skatteutgift_id, {
        amount_mkr: Number(f.amount_mkr),
        is_estimated: f.is_estimated,
      });
    }
    return dim.data
      .map(d => ({
        ...d,
        amount_mkr: factByCode.get(d.skatteutgift_id)?.amount_mkr ?? null,
        is_estimated: factByCode.get(d.skatteutgift_id)?.is_estimated ?? false,
      }))
      .sort((a, b) => (b.amount_mkr ?? -1) - (a.amount_mkr ?? -1));
  })();

  const total = rows.reduce((s, r) => s + (r.amount_mkr ?? 0), 0);
  const hasData = total > 0;

  const fmtMkr = (v: number) =>
    `${new Intl.NumberFormat(isEnglish ? 'en-GB' : 'sv-SE').format(Math.round(v))} ${t('skatteutgifter.unit')}`;

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = (() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const desc = (isEnglish && r.description_en) || r.description_sv || '';
      const match = desc.match(/kategori\s+([A-G])\.\s+([^.]+)/i);
      if (match) map.set(match[1], match[2].trim());
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  const filteredRows = rows.filter(r => {
    const name = (isEnglish && r.name_en ? r.name_en : r.name_sv) || '';
    const desc = (isEnglish && r.description_en) || r.description_sv || '';
    const matchesSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || desc.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || desc.includes(`kategori ${categoryFilter}.`);
    return matchesSearch && matchesCategory;
  });

  const filteredTotal = filteredRows.reduce((s, r) => s + (r.amount_mkr ?? 0), 0);

  return (
    <Layout>
      <Helmet>
        <title>{t('skatteutgifter.title')} — Statsbudget</title>
        <meta name="description" content={t('skatteutgifter.intro')} />
      </Helmet>

      <section className="border-b border-border bg-muted/40 py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('skatteutgifter.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('skatteutgifter.intro')}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('skatteutgifter.disclosure')}
          </p>
        </div>
      </section>

      <ComparisonSection />

      <section className="py-10 sm:py-14 border-t border-border">
        <div className="container max-w-5xl">
          <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl mb-6">
            {t('skatteutgifter.allHeading')}
          </h2>

          <div className="mb-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteutgifter.year')}</span>
              <select
                className="rounded-md border border-input bg-background px-3 py-2"
                value={selectedYear ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  const next = new URLSearchParams(params);
                  if (v) next.set('year', v); else next.delete('year');
                  setParams(next, { replace: true });
                }}
              >
                {(availableYears.length > 0 ? availableYears : (years.data ?? []).map(y => y.year_id))
                  .map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteutgifter.category')}</span>
              <select
                className="rounded-md border border-input bg-background px-3 py-2"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="all">{t('skatteutgifter.allCategories')}</option>
                {categories.map(([key, label]) => (
                  <option key={key} value={key}>{key}. {label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteutgifter.search')}</span>
              <input
                type="text"
                placeholder={t('skatteutgifter.searchPlaceholder')}
                className="rounded-md border border-input bg-background px-3 py-2 w-full sm:w-56"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
            {hasData && (
              <div className="text-sm text-muted-foreground ml-auto">
                {filteredRows.length !== rows.length && (
                  <span>{t('skatteutgifter.filterCount', { count: filteredRows.length, total: rows.length })} · </span>
                )}
                {t('skatteutgifter.totalLabel')}: <strong className="text-foreground">{fmtMkr(filteredTotal)}</strong>
              </div>
            )}
          </div>

          {!hasData && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              <strong className="text-foreground">{t('skatteutgifter.demoBadge')}</strong>{' '}
              {t('skatteutgifter.noData')}
            </div>
          )}

          {hasData && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('skatteutgifter.col.name')}</th>
                    <th className="px-4 py-2 font-medium hidden sm:table-cell">{t('skatteutgifter.col.description')}</th>
                    <th className="px-4 py-2 font-medium text-right">{t('skatteutgifter.col.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map(r => (
                    <tr key={r.skatteutgift_id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {isEnglish && r.name_en ? r.name_en : r.name_sv}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {(isEnglish && r.description_en) || r.description_sv}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {r.amount_mkr != null ? fmtMkr(r.amount_mkr) : '—'}
                        {r.is_estimated && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({t('skatteutgifter.estimated')})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        {t('skatteutgifter.noMatch')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong>{t('skatteutgifter.sourcesLabel')}:</strong>{' '}
              <a
                className="text-primary hover:underline"
                href="https://www.regeringen.se/search?query=skatteutgifter+bilaga"
                target="_blank"
                rel="noopener noreferrer"
              >
                Regeringens skatteutgiftsbilaga
              </a>
              {' · '}
              <a
                className="text-primary hover:underline"
                href="https://www.esv.se/statsbudgetens-utveckling/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ESV inkomstutfall
              </a>
            </p>
            <p>{t('skatteutgifter.caveat')}</p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default SkatteutgifterPage;
