import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  getAreas, getParties, getBudgetByYear,
  convertAmount, formatAmount,
} from '@/lib/budget-queries';
import type { DisplayMode, DimArea, DimParty, FactBudget } from '@/lib/supabase-types';
import { CHROME } from '@/lib/palette';
import { useActiveLang, localizeAreaName, formatMkrLocalized } from '@/lib/area-i18n';

echarts.use([BarChart, TooltipComponent, GridComponent, CanvasRenderer]);

const SHADOW_YEARS = [2025, 2026] as const;

const GOV_PARTIES = new Set(['GOV', 'M', 'KD', 'L', 'SD', 'ALLIANSEN']);

const PartyBudgetComparison = () => {
  const { t } = useTranslation();
  const lang = useActiveLang();
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: getAreas });
  const { data: parties } = useQuery({ queryKey: ['parties'], queryFn: getParties });
  const { data: budgetData } = useQuery({
    queryKey: ['budget', selectedYear],
    queryFn: () => getBudgetByYear(selectedYear),
    enabled: !!selectedYear,
  });
  // 2026 has no actual baseline yet — use 2025 actuals as reference
  const { data: baselineData } = useQuery({
    queryKey: ['budget', 2025],
    queryFn: () => getBudgetByYear(2025),
    enabled: selectedYear === 2026,
  });

  const oppositionParties = useMemo(
    () => (parties ?? []).filter((p) => !GOV_PARTIES.has(p.code)),
    [parties],
  );

  const shadowData = useMemo(() => {
    if (!budgetData || !areas || !oppositionParties.length) return [];
    const govByArea = new Map<number, number>();
    const deltasByPartyArea = new Map<string, number>();

    // For years without actual data (e.g. 2026), use baseline from prior year
    const actualSource = selectedYear === 2026 && baselineData ? baselineData : budgetData;
    for (const f of actualSource) {
      if (f.budget_type === 'actual' && f.anslag_id == null) {
        govByArea.set(f.area_id, f.amount_nominal_sek);
      }
    }
    for (const f of budgetData) {
      if (f.budget_type === 'shadow_delta' && f.anslag_id == null && f.party_id != null) {
        deltasByPartyArea.set(`${f.party_id}-${f.area_id}`, f.amount_nominal_sek);
      }
    }

    return (areas ?? [])
      .filter((a) => govByArea.has(a.area_id))
      .map((a) => {
        const gov = govByArea.get(a.area_id) ?? 0;
        const deltas = oppositionParties.map((p) => ({
          party: p,
          delta: deltasByPartyArea.get(`${p.party_id}-${a.area_id}`) ?? 0,
        }));
        return { area: a, govAmount: gov, deltas };
      })
      .sort((a, b) => {
        const aMax = Math.max(...a.deltas.map((d) => Math.abs(d.delta)));
        const bMax = Math.max(...b.deltas.map((d) => Math.abs(d.delta)));
        return bMax - aMax;
      });
  }, [budgetData, baselineData, areas, oppositionParties, selectedYear]);

  const hasShadowData = shadowData.some((r) => r.deltas.some((d) => d.delta !== 0));

  const totalDeltas = useMemo(() => {
    if (!oppositionParties.length) return [];
    return oppositionParties.map((p) => {
      const sum = shadowData.reduce(
        (s, r) => s + (r.deltas.find((d) => d.party.party_id === p.party_id)?.delta ?? 0),
        0,
      );
      return { party: p, total: sum };
    }).filter((d) => d.total !== 0);
  }, [shadowData, oppositionParties]);

  const summaryOption: echarts.EChartsCoreOption = useMemo(() => {
    if (!totalDeltas.length) return {};
    const sorted = [...totalDeltas].sort((a, b) => b.total - a.total);
    return {
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: CHROME.surface,
        borderColor: CHROME.border,
        textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const row = sorted[p.dataIndex];
          const sign = row.total >= 0 ? '+' : '';
          return `<strong>${row.party.name_sv}</strong><br/>${sign}${formatMkrLocalized(row.total / 1e6, lang)} vs regeringen`;
        },
      },
      grid: { left: window.innerWidth < 640 ? 80 : 120, right: 16, top: 8, bottom: 24 },
      xAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          formatter: (v: number) => {
            if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(0)} mdr`;
            if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)} mkr`;
            return `${v}`;
          },
        },
        splitLine: { lineStyle: { color: CHROME.border, type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: sorted.map((d) => d.party.name_sv),
        axisLabel: { fontSize: 12 },
        axisTick: { show: false },
        axisLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: sorted.map((d) => ({
            value: d.total,
            itemStyle: { color: `#${d.party.color_hex}` },
          })),
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'right',
            fontSize: 11,
            formatter: (p: any) => {
              const v = p.value as number;
              const sign = v >= 0 ? '+' : '';
              if (Math.abs(v) >= 1e9) return `${sign}${(v / 1e9).toFixed(1)} mdr`;
              return `${sign}${(v / 1e6).toFixed(0)} mkr`;
            },
          },
          animationDuration: prefersReducedMotion ? 0 : 600,
        },
      ],
    };
  }, [totalDeltas, lang, prefersReducedMotion]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {t('explorer.partyComparison')}
        </h3>
        <div className="flex gap-1">
          {SHADOW_YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`rounded-md px-3 py-1 text-sm transition-colors ${
                selectedYear === y
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {!hasShadowData ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('explorer.noPartyData')}
        </p>
      ) : (
        <>
          <ReactEChartsCore
            echarts={echarts}
            option={summaryOption}
            style={{ height: `${Math.max(180, totalDeltas.length * 44)}px`, width: '100%' }}
            // @ts-expect-error echarts-for-react spreads extra props to wrapper div
            role="img"
            aria-label={`Partiernas budgetavvikelser ${selectedYear}`}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t('explorer.partyComparisonSource')}{' '}
            <a
              href="https://www.riksdagen.se/sv/dokument-och-lagar/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              riksdagen.se ↗
            </a>
          </p>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-primary hover:underline">
              {t('explorer.showPerArea')}
            </summary>

            {/* Desktop: table layout */}
            <div className="mt-3 hidden sm:block overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('explorer.areaColumn')}</th>
                    {oppositionParties.filter((p) => totalDeltas.some((td) => td.party.party_id === p.party_id)).map((p) => (
                      <th key={p.party_id} className="px-3 py-2 text-right font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: `#${p.color_hex}` }}
                          />
                          {p.code}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shadowData.slice(0, 27).map((r) => (
                    <tr key={r.area.area_id} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">
                        {localizeAreaName(r.area.name_sv, lang)}
                      </td>
                      {oppositionParties.filter((p) => totalDeltas.some((td) => td.party.party_id === p.party_id)).map((p) => {
                        const d = r.deltas.find((dd) => dd.party.party_id === p.party_id);
                        const v = d?.delta ?? 0;
                        if (v === 0) return <td key={p.party_id} className="px-3 py-2 text-right text-muted-foreground">—</td>;
                        const sign = v > 0 ? '+' : '';
                        return (
                          <td
                            key={p.party_id}
                            className={`px-3 py-2 text-right tabular-nums ${v > 0 ? 'text-green-700' : 'text-red-600'}`}
                          >
                            {sign}{formatMkrLocalized(v / 1e6, lang)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: stacked card layout */}
            <div className="mt-3 sm:hidden space-y-3">
              {shadowData.slice(0, 27).filter((r) => r.deltas.some((d) => d.delta !== 0)).map((r) => (
                <div key={r.area.area_id} className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground mb-2">
                    {localizeAreaName(r.area.name_sv, lang)}
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    {oppositionParties
                      .filter((p) => totalDeltas.some((td) => td.party.party_id === p.party_id))
                      .map((p) => {
                        const d = r.deltas.find((dd) => dd.party.party_id === p.party_id);
                        const v = d?.delta ?? 0;
                        if (v === 0) return null;
                        const sign = v > 0 ? '+' : '';
                        return (
                          <div key={p.party_id} className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: `#${p.color_hex}` }}
                              />
                              {p.code}
                            </span>
                            <span className={`tabular-nums ${v > 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {sign}{formatMkrLocalized(v / 1e6, lang)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default PartyBudgetComparison;
