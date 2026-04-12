import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import Layout from '@/components/Layout';
import SourceLink from '@/components/SourceLink';
import LangMeta from '@/components/LangMeta';
import PolicyTimeline from '@/components/historical/PolicyTimeline';
import {
  getAreas,
  getBudgetByYear,
  getHistoricalFact,
  getHistoricalYearMeta,
  getYears,
} from '@/lib/budget-queries';
import { stableColor, CHROME, ECHARTS_COLOR_ARRAY } from '@/lib/palette';
import { getOgImageUrl } from '@/lib/site-runtime';
import type { DimArea, DimYear, FactBudget, FactHistorical } from '@/lib/supabase-types';

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

const SNAPSHOT_YEARS = [1975, 1980, 1985] as const;

const formatMkr = (mkr: number): string => {
  if (Math.abs(mkr) >= 1000) return `${(mkr / 1000).toFixed(1)} mdr kr`;
  return `${Math.round(mkr).toLocaleString('sv-SE')} mkr`;
};

const HistoricalPage = () => {
  const { t } = useTranslation();
  const ogImage = getOgImageUrl({ historical: 1 });

  const { data: years } = useQuery({ queryKey: ['years'], queryFn: getYears });
  const latestYear = useMemo(() => {
    if (!years) return null;
    const regular = years
      .filter((y) => !y.is_historical && y.year_id <= 2025)
      .sort((a, b) => b.year_id - a.year_id);
    return regular[0]?.year_id ?? null;
  }, [years]);

  return (
    <Layout>
      <LangMeta svPath="/historical" />
      <Helmet>
        <title>{t('historical.heading')} — Statsbudget</title>
        <meta name="description" content={t('historical.intro')} />
        <meta property="og:title" content={t('historical.heading')} />
        <meta property="og:description" content={t('historical.intro')} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      <section className="py-12 sm:py-16">
        <div className="container">
          <header className="max-w-3xl">
            <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {t('historical.heading')}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              {t('historical.intro')}
            </p>
          </header>

          <PolicyTimeline />

          <div className="mt-10 grid gap-10 lg:grid-cols-3">
            {/* Left 2 cols: snapshot sections, scrolls normally */}
            <div className="space-y-16 lg:col-span-2">
              {SNAPSHOT_YEARS.map((year) => (
                <SnapshotSection key={year} year={year} />
              ))}
            </div>

            {/* Right 1 col: sticky today pie, follows scroll */}
            <aside className="lg:col-span-1">
              <div className="sticky top-24">
                <TodayPanel year={latestYear} />
              </div>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
};

const SnapshotSection = ({ year }: { year: number }) => {
  const { data: rows, isLoading } = useQuery({
    queryKey: ['historical_fact', year],
    queryFn: () => getHistoricalFact(year),
  });
  const { data: meta } = useQuery({
    queryKey: ['historical_meta', year],
    queryFn: () => getHistoricalYearMeta(year),
  });

  const total = useMemo(
    () => (rows ?? []).reduce((s, r) => s + Number(r.amount_mkr), 0),
    [rows],
  );
  const sorted = useMemo(
    () => [...(rows ?? [])].sort((a, b) => Number(b.amount_mkr) - Number(a.amount_mkr)),
    [rows],
  );
  const hasUncertain = sorted.some((r) => r.is_uncertain);

  return (
    <article className="scroll-mt-24" id={`snapshot-${year}`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-display text-3xl font-semibold text-foreground">
          {year}
        </h2>
        {meta?.fiscal_year_label && (
          <span className="text-sm uppercase tracking-wide text-muted-foreground">
            Budgetåret {meta.fiscal_year_label}
          </span>
        )}
      </div>

      {meta?.historical_context_sv && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {meta.historical_context_sv}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-muted-foreground">Total statsbudget:</span>
        <span className="font-display text-2xl font-semibold text-foreground">
          {formatMkr(total)}
        </span>
      </div>

      {hasUncertain && (
        <div role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          <span aria-hidden="true">⚠ </span>Enskilda rader är osäkra — markerade med gul punkt. Se källa för manuell verifiering.
        </div>
      )}

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Laddar…</p>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-5">
          <div className="md:col-span-2">
            <HistoricalPie rows={sorted} total={total} year={year} />
          </div>
          <ul className="md:col-span-3 space-y-2 self-start">
            {sorted.map((r) => {
              const pct = total > 0 ? (Number(r.amount_mkr) / total) * 100 : 0;
              return (
                <li key={r.fact_id} className="flex items-center gap-3 text-sm">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: stableColor(r.category_sv) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-foreground">{r.category_sv}</span>
                      {r.is_uncertain && (
                        <span
                          aria-label="Osäker siffra"
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                        />
                      )}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${r.category_sv}: ${pct.toFixed(1)}%`}
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: stableColor(r.category_sv) }}
                      />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 shrink-0 tabular-nums text-right">
                    <span className="text-foreground">{formatMkr(Number(r.amount_mkr))}</span>
                    <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {meta?.historical_source_url && (
          <a
            href={meta.historical_source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Källa: Riksdagen ↗
          </a>
        )}
        <SourceLink sources="Riksdagen" />
      </div>
    </article>
  );
};

const HistoricalPie = ({
  rows,
  total,
  year,
}: {
  rows: FactHistorical[];
  total: number;
  year: number;
}) => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const option: echarts.EChartsCoreOption = useMemo(
    () => ({
      color: ECHARTS_COLOR_ARRAY,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: CHROME.surface,
        borderColor: CHROME.border,
        extraCssText: 'max-width:240px; white-space:normal; word-break:break-word;',
        textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
        formatter: (p: any) =>
          `<div style="max-width:220px;line-height:1.4"><strong>${p.name}</strong><br/>${formatMkr(p.value)} · ${p.percent}%</div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '74%'],
          center: ['50%', '50%'],
          minAngle: 3,
          padAngle: 0.5,
          itemStyle: { borderRadius: 2, borderColor: CHROME.bg, borderWidth: 1 },
          label: { show: false },
          labelLine: { show: false },
          data: rows.map((r) => ({
            name: r.category_sv,
            value: Number(r.amount_mkr),
            itemStyle: { color: stableColor(r.category_sv) },
          })),
          animationDuration: prefersReducedMotion ? 0 : 500,
          animationEasing: 'cubicOut',
        },
      ],
    }),
    [rows, prefersReducedMotion],
  );

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border/60">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Fördelning</p>
      <p className="font-display text-lg font-semibold text-foreground">{year}</p>
      {rows.length > 0 ? (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: '280px', width: '100%' }}
          // @ts-expect-error echarts-for-react spreads extra props to wrapper div
          role="img"
          aria-label={`Statsbudget ${year}`}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">Ingen data</p>
      )}
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Totalt {formatMkr(total)}
      </p>
    </div>
  );
};

const TodayPanel = ({ year }: { year: number | null }) => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: getAreas });
  const { data: budget } = useQuery<FactBudget[]>({
    queryKey: ['budget', year],
    queryFn: () => (year ? getBudgetByYear(year) : Promise.resolve([])),
    enabled: !!year,
  });

  const rows = useMemo(() => {
    if (!budget || !areas) return [] as { area: DimArea; amount: number }[];
    return budget
      .filter((f) => f.budget_type !== 'shadow_delta' && f.anslag_id == null)
      .map((f) => {
        const area = areas.find((a: DimArea) => a.area_id === f.area_id);
        return area ? { area, amount: f.amount_nominal_sek } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b!.amount - a!.amount) as { area: DimArea; amount: number }[];
  }, [budget, areas]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const option: echarts.EChartsCoreOption = useMemo(
    () => ({
      color: ECHARTS_COLOR_ARRAY,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: CHROME.surface,
        borderColor: CHROME.border,
        extraCssText: 'max-width:240px; white-space:normal; word-break:break-word;',
        textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
        formatter: (p: any) =>
          `<div style="max-width:220px;line-height:1.4"><strong>${p.name}</strong><br/>${formatMkr(p.value)} · ${p.percent}%</div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '74%'],
          center: ['50%', '50%'],
          minAngle: 3,
          padAngle: 0.5,
          itemStyle: { borderRadius: 2, borderColor: CHROME.bg, borderWidth: 1 },
          label: { show: false },
          labelLine: { show: false },
          data: rows.map((r) => ({
            name: r.area.name_sv,
            value: r.amount,
            itemStyle: { color: stableColor(r.area.name_sv) },
          })),
          animationDuration: prefersReducedMotion ? 0 : 500,
          animationEasing: 'cubicOut',
        },
      ],
    }),
    [rows, prefersReducedMotion],
  );

  if (!year) return null;

  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-border/60 transition-all">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Till jämförelse</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          Statsbudgeten idag · {year}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Totalt {formatMkr(total)}
        </p>
      </div>
      {rows.length > 0 ? (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: '320px', width: '100%' }}
          // @ts-expect-error echarts-for-react spreads extra props to wrapper div
          role="img"
          aria-label={`Statsbudget ${year}`}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">Laddar…</p>
      )}
      <ul className="mt-4 max-h-[220px] space-y-1.5 overflow-y-auto pr-1 text-xs">
        {rows.slice(0, 10).map((r) => {
          const pct = total > 0 ? (r.amount / total) * 100 : 0;
          return (
            <li key={r.area.area_id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: stableColor(r.area.name_sv) }}
              />
              <span className="min-w-0 flex-1 truncate text-foreground">{r.area.name_sv}</span>
              <span className="tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <SourceLink sources="ESV" />
      </div>
    </div>
  );
};

export default HistoricalPage;
