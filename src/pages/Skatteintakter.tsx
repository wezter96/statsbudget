import { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import IncomePieChart from '@/components/income/IncomePieChart';
import IncomeTrendChart from '@/components/income/IncomeTrendChart';
import YearRangeSlider from '@/components/explorer/YearRangeSlider';
import { cn } from '@/lib/utils';
import {
  getIncomeGroups,
  getIncomeFacts,
  getIncomeTimeSeries,
  getYears,
} from '@/lib/budget-queries';

const SkatteintakterPage = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const [params, setParams] = useSearchParams();

  const years = useQuery({ queryKey: ['years'], queryFn: getYears });
  const groups = useQuery({ queryKey: ['income-groups'], queryFn: getIncomeGroups });
  const series = useQuery({ queryKey: ['income-series'], queryFn: getIncomeTimeSeries });

  // Derive available years from fact data
  const availableYears = useMemo(() => {
    if (!series.data) return [];
    const set = new Set<number>();
    for (const f of series.data) set.add(f.year_id);
    return Array.from(set).sort((a, b) => a - b);
  }, [series.data]);

  const defaultYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : years.data?.at(-1)?.year_id;
  const yearParam = params.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : defaultYear;

  const facts = useQuery({
    queryKey: ['income-facts', selectedYear],
    queryFn: () => (selectedYear ? getIncomeFacts(selectedYear) : Promise.resolve([])),
    enabled: selectedYear != null,
  });

  // Compare year
  const [compareActive, setCompareActive] = useState(false);
  const [compareYear, setCompareYear] = useState<number | null>(null);

  useEffect(() => {
    if (selectedYear && !compareYear) {
      setCompareYear(selectedYear - 1);
    }
  }, [selectedYear, compareYear]);

  const effectiveCompareYear = compareActive && compareYear ? compareYear : (selectedYear ? selectedYear - 1 : undefined);
  const compareFacts = useQuery({
    queryKey: ['income-facts', effectiveCompareYear],
    queryFn: () => (effectiveCompareYear ? getIncomeFacts(effectiveCompareYear) : Promise.resolve([])),
    enabled: effectiveCompareYear != null && effectiveCompareYear > 0,
  });

  // Year range for trend chart
  const [yearFrom, setYearFrom] = useState(0);
  const [yearTo, setYearTo] = useState(0);

  useEffect(() => {
    if (availableYears.length > 0 && yearFrom === 0) {
      setYearFrom(availableYears[0]);
      setYearTo(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, yearFrom]);

  // Build group rows with amounts
  const groupRows = useMemo(() => {
    if (!groups.data || !facts.data) return [];
    const factByTitle = new Map<number, { amount: number; estimated: boolean }>();
    for (const f of facts.data) {
      factByTitle.set(f.income_title_id, { amount: Number(f.amount_mkr), estimated: f.is_estimated });
    }
    const prevByTitle = new Map<number, number>();
    for (const f of compareFacts.data ?? []) {
      prevByTitle.set(f.income_title_id, Number(f.amount_mkr));
    }

    const rows = groups.data
      .map(g => {
        const amount = factByTitle.get(g.income_title_id)?.amount ?? 0;
        const estimated = factByTitle.get(g.income_title_id)?.estimated ?? false;
        const prevAmount = prevByTitle.get(g.income_title_id);
        const changePct = prevAmount && prevAmount !== 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
        return {
          group: g,
          amount_mkr: amount,
          is_estimated: estimated,
          changePct,
          compareAmount: compareActive ? (prevAmount ?? null) : null,
        };
      })
      .filter(r => r.amount_mkr !== 0)
      .sort((a, b) => b.amount_mkr - a.amount_mkr);

    const total = rows.reduce((s, r) => s + r.amount_mkr, 0);
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.amount_mkr / total) * 100 : 0 }));
  }, [groups.data, facts.data, compareFacts.data, compareActive]);

  // Pie data
  const pieRows = groupRows.map(r => ({
    group: r.group,
    amount_mkr: r.amount_mkr,
    pct: r.pct,
    changePct: r.changePct,
    is_estimated: r.is_estimated,
  }));

  // Trend data: one series per top-level group, filtered by year range
  const trendData = useMemo(() => {
    if (!groups.data || !series.data) return { series: [], yearFrom: 0, yearTo: 0 };
    const groupIds = new Set(groups.data.map(g => g.income_title_id));
    const byGroup = new Map<number, { year: number; value: number }[]>();
    for (const f of series.data) {
      if (!groupIds.has(f.income_title_id)) continue;
      if (f.year_id < yearFrom || f.year_id > yearTo) continue;
      const arr = byGroup.get(f.income_title_id) ?? [];
      arr.push({ year: f.year_id, value: Number(f.amount_mkr) });
      byGroup.set(f.income_title_id, arr);
    }
    const trendSeries = groups.data
      .filter(g => byGroup.has(g.income_title_id))
      .map(g => ({
        name: isEn && g.name_en ? g.name_en : g.name_sv,
        colorKey: g.name_sv,
        data: byGroup.get(g.income_title_id)!,
      }));
    return { series: trendSeries, yearFrom, yearTo };
  }, [groups.data, series.data, isEn, yearFrom, yearTo]);

  const total = groupRows.reduce((s, r) => s + r.amount_mkr, 0);
  const hasData = total > 0;

  const fmtMdr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr kr`;
  };

  const availableYearsDesc = useMemo(() => [...availableYears].reverse(), [availableYears]);

  return (
    <Layout>
      <Helmet>
        <title>{t('skatteintakter.title')} — Statsbudget</title>
        <meta name="description" content={t('skatteintakter.intro')} />
        <meta property="og:title" content={`${t('skatteintakter.title')} — Statsbudget`} />
        <meta property="og:description" content={t('skatteintakter.intro')} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Hero */}
      <section className="border-b border-border bg-muted/40 py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('skatteintakter.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('skatteintakter.intro')}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('skatteintakter.disclosure')}
          </p>
        </div>
      </section>

      {/* Pie chart + expandable table */}
      <section className="py-10 sm:py-14 border-t border-border">
        <div className="container max-w-5xl">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                {t('skatteintakter.pieHeading')} {selectedYear || ''}
              </h2>
              {hasData && (
                <span className="text-sm text-muted-foreground">
                  {t('skatteintakter.total')}:{' '}
                  <span className="font-display text-base font-semibold text-foreground tabular-nums">
                    {fmtMdr(total)}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-border bg-card pl-3 pr-8 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
                value={selectedYear ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  const next = new URLSearchParams(params);
                  if (v) next.set('year', v); else next.delete('year');
                  setParams(next, { replace: true });
                }}
              >
                {availableYearsDesc.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={() => setCompareActive(prev => !prev)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                  compareActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30',
                )}
              >
                {t('explorer.compare')}
              </button>
              {compareActive && (
                <div className="flex items-center gap-1.5">
                  <label htmlFor="income-compare-year" className="text-sm text-muted-foreground">
                    {t('explorer.compareWith')}
                  </label>
                  <select
                    id="income-compare-year"
                    value={compareYear ?? ''}
                    onChange={e => setCompareYear(Number(e.target.value))}
                    className="rounded-lg border border-border bg-card pl-3 pr-8 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
                  >
                    {availableYearsDesc
                      .filter(y => y !== selectedYear)
                      .map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {!hasData && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              {t('skatteintakter.noData')}
            </div>
          )}

          {hasData && (
            <IncomePieChart
              rows={pieRows}
              year={selectedYear!}
              facts={facts.data ?? []}
            />
          )}
        </div>
      </section>

      {/* Trend chart */}
      {trendData.series.length > 0 && (
        <section className="py-10 sm:py-14 border-t border-border">
          <div className="container max-w-5xl">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
                {t('skatteintakter.trendHeading')} {yearFrom || ''}–{yearTo || ''}
              </h2>
            </div>

            {availableYears.length > 1 && (
              <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-card/60 p-3 ring-1 ring-border/60">
                <YearRangeSlider
                  min={availableYears[0]}
                  max={availableYears[availableYears.length - 1]}
                  from={yearFrom}
                  to={yearTo}
                  onChange={(f, tt) => { setYearFrom(f); setYearTo(tt); }}
                />
              </div>
            )}

            <IncomeTrendChart
              series={trendData.series}
              yearFrom={trendData.yearFrom}
              yearTo={trendData.yearTo}
            />
          </div>
        </section>
      )}

      {/* Sources */}
      <section className="py-6 border-t border-border">
        <div className="container max-w-5xl space-y-2 text-xs text-muted-foreground">
          <p>
            <strong>{t('skatteintakter.sourcesLabel')}:</strong>{' '}
            <a
              className="text-primary underline underline-offset-2"
              href="https://www.esv.se/statens-ekonomi/statens-budget/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ESV — Statens budget
            </a>
            {' · '}
            <a
              className="text-primary underline underline-offset-2"
              href="https://www.statistikdatabasen.scb.se/"
              target="_blank"
              rel="noopener noreferrer"
            >
              SCB Statistikdatabasen
            </a>
          </p>
          <p>{t('skatteintakter.caveat')}</p>
        </div>
      </section>
    </Layout>
  );
};

export default SkatteintakterPage;
