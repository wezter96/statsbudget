import { useState, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import IncomePieChart from '@/components/income/IncomePieChart';
import IncomeTrendChart from '@/components/income/IncomeTrendChart';
import IncomeTable from '@/components/income/IncomeTable';
import {
  getIncomeGroups,
  getIncomeFacts,
  getIncomeTimeSeries,
  getYears,
} from '@/lib/budget-queries';
import type { FactIncome } from '@/lib/supabase-types';

const SkatteintakterPage = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const [params, setParams] = useSearchParams();
  const tableRef = useRef<HTMLDivElement>(null);

  const years = useQuery({ queryKey: ['years'], queryFn: getYears });
  const groups = useQuery({ queryKey: ['income-groups'], queryFn: getIncomeGroups });
  const series = useQuery({ queryKey: ['income-series'], queryFn: getIncomeTimeSeries });

  // Derive available years from fact data
  const availableYears = useMemo(() => {
    if (!series.data) return [];
    const set = new Set<number>();
    for (const f of series.data) set.add(f.year_id);
    return Array.from(set).sort((a, b) => b - a);
  }, [series.data]);

  const defaultYear = availableYears[0] ?? years.data?.at(-1)?.year_id;
  const yearParam = params.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : defaultYear;

  const facts = useQuery({
    queryKey: ['income-facts', selectedYear],
    queryFn: () => (selectedYear ? getIncomeFacts(selectedYear) : Promise.resolve([])),
    enabled: selectedYear != null,
  });

  // Previous year facts for change calculation
  const prevYear = selectedYear ? selectedYear - 1 : undefined;
  const prevFacts = useQuery({
    queryKey: ['income-facts', prevYear],
    queryFn: () => (prevYear ? getIncomeFacts(prevYear) : Promise.resolve([])),
    enabled: prevYear != null && availableYears.includes(prevYear),
  });

  // Build group rows with amounts
  const groupRows = useMemo(() => {
    if (!groups.data || !facts.data) return [];
    const factByTitle = new Map<number, { amount: number; estimated: boolean }>();
    for (const f of facts.data) {
      factByTitle.set(f.income_title_id, { amount: Number(f.amount_mkr), estimated: f.is_estimated });
    }
    const prevByTitle = new Map<number, number>();
    for (const f of prevFacts.data ?? []) {
      prevByTitle.set(f.income_title_id, Number(f.amount_mkr));
    }

    const rows = groups.data
      .map(g => {
        const amount = factByTitle.get(g.income_title_id)?.amount ?? 0;
        const estimated = factByTitle.get(g.income_title_id)?.estimated ?? false;
        const prevAmount = prevByTitle.get(g.income_title_id);
        const changePct = prevAmount && prevAmount !== 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
        return { group: g, amount_mkr: amount, is_estimated: estimated, changePct };
      })
      .filter(r => r.amount_mkr !== 0)
      .sort((a, b) => b.amount_mkr - a.amount_mkr);

    const total = rows.reduce((s, r) => s + r.amount_mkr, 0);
    return rows.map(r => ({ ...r, pct: total > 0 ? (r.amount_mkr / total) * 100 : 0 }));
  }, [groups.data, facts.data, prevFacts.data]);

  // Pie data
  const pieRows = groupRows.map(r => ({
    group: r.group,
    amount_mkr: r.amount_mkr,
    pct: r.pct,
  }));

  // Trend data: one series per top-level group
  const trendData = useMemo(() => {
    if (!groups.data || !series.data) return { series: [], yearFrom: 0, yearTo: 0 };
    const groupIds = new Set(groups.data.map(g => g.income_title_id));
    const byGroup = new Map<number, { year: number; value: number }[]>();
    for (const f of series.data) {
      if (!groupIds.has(f.income_title_id)) continue;
      const arr = byGroup.get(f.income_title_id) ?? [];
      arr.push({ year: f.year_id, value: Number(f.amount_mkr) });
      byGroup.set(f.income_title_id, arr);
    }
    const allYears = series.data.map(f => f.year_id);
    const yearFrom = Math.min(...allYears);
    const yearTo = Math.max(...allYears);
    const trendSeries = groups.data
      .filter(g => byGroup.has(g.income_title_id))
      .map(g => ({
        name: isEn && g.name_en ? g.name_en : g.name_sv,
        colorKey: g.name_sv,
        data: byGroup.get(g.income_title_id)!,
      }));
    return { series: trendSeries, yearFrom, yearTo };
  }, [groups.data, series.data, isEn]);

  const total = groupRows.reduce((s, r) => s + r.amount_mkr, 0);
  const hasData = total > 0;

  const fmtMdr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr kr`;
  };

  const [search, setSearch] = useState('');
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  const handleGroupClick = (id: number) => {
    setExpandedGroupId(prev => prev === id ? null : id);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

      {/* Pie chart overview */}
      <section className="py-10 sm:py-14 border-t border-border">
        <div className="container max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                {t('skatteintakter.pieHeading')}
              </h2>
              {hasData && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('skatteintakter.total')}: <strong className="text-foreground">{fmtMdr(total)}</strong>
                  {' '}({selectedYear})
                </p>
              )}
            </div>
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteintakter.year')}</span>
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
              onGroupClick={handleGroupClick}
            />
          )}
        </div>
      </section>

      {/* Trend chart */}
      {trendData.series.length > 0 && (
        <section className="py-10 sm:py-14 border-t border-border">
          <div className="container max-w-5xl">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl mb-6">
              {t('skatteintakter.trendHeading')}
            </h2>
            <IncomeTrendChart
              series={trendData.series}
              yearFrom={trendData.yearFrom}
              yearTo={trendData.yearTo}
            />
          </div>
        </section>
      )}

      {/* Detailed table */}
      <section ref={tableRef} className="py-10 sm:py-14 border-t border-border">
        <div className="container max-w-5xl">
          <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl mb-6">
            {t('skatteintakter.tableHeading')}
          </h2>

          <div className="mb-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteintakter.search')}</span>
              <input
                type="text"
                placeholder={t('skatteintakter.searchPlaceholder')}
                className="rounded-md border border-input bg-background px-3 py-2 w-full sm:w-56"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </label>
          </div>

          {hasData && (
            <IncomeTable
              rows={groupRows}
              year={selectedYear!}
              facts={facts.data ?? []}
              search={search}
              expandedGroupId={expandedGroupId}
              onToggleGroup={(id) => setExpandedGroupId(prev => prev === id ? null : id)}
            />
          )}

          <div className="mt-8 space-y-2 text-xs text-muted-foreground">
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
        </div>
      </section>
    </Layout>
  );
};

export default SkatteintakterPage;
