import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { stableColor, CHROME, ECHARTS_COLOR_ARRAY } from '@/lib/palette';
import { useAreaName, useActiveLang, formatMkrLocalized } from '@/lib/area-i18n';
import { cn } from '@/lib/utils';
import { formatAmount, getBudgetByYear, getAnslagByArea } from '@/lib/budget-queries';
import SourceLink from '@/components/SourceLink';
import type { DimArea, DimYear, DisplayMode } from '@/lib/supabase-types';

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

export interface PieRow {
  area: DimArea;
  value: number;       // value in current display mode
  rawAmount: number;   // raw Mkr for drill-down math
  pct: number;         // share of total
}

interface Props {
  rows: PieRow[];
  mode: DisplayMode;
  year: number;
  yearData?: DimYear;
}

/**
 * Pie chart + synced table.
 * - Hover slice ↔ row highlight (bidirectional via echarts dispatchAction).
 * - Click row → inline expands to show a nested anslag pie.
 */
const BudgetPieTable = ({ rows, mode, year, yearData: _yearData }: Props) => {
  const { t } = useTranslation();
  const localizeArea = useAreaName();
  const lang = useActiveLang();
  const mkr = (n: number) => formatMkrLocalized(n, lang);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chartRef = useRef<any>(null);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [expandedAreaId, setExpandedAreaId] = useState<number | null>(null);

  const pieData = useMemo(
    () =>
      rows.map((r) => ({
        name: localizeArea(r.area.name_sv),
        value: r.value,
        areaId: r.area.area_id,
        // colour key stays Swedish so the same category always gets the same hue
        itemStyle: { color: stableColor(r.area.name_sv) },
      })),
    [rows, localizeArea],
  );

  const option: echarts.EChartsCoreOption = useMemo(
    () => ({
      color: ECHARTS_COLOR_ARRAY,
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: CHROME.surface,
        borderColor: CHROME.border,
        extraCssText: 'max-width:260px; white-space:normal; word-break:break-word; box-shadow:0 4px 16px rgba(0,0,0,0.08);',
        textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
        formatter: (p: any) =>
          `<div style="max-width:240px;line-height:1.4"><strong style="font-family:Fraunces,serif;display:block;margin-bottom:4px">${p.name}</strong>${formatAmount(p.value, mode)} · ${p.percent}%</div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '74%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          minAngle: 3,              // guarantee tiny slices stay visible + clickable
          padAngle: 0.5,
          itemStyle: {
            borderRadius: 2,
            borderColor: CHROME.bg,
            borderWidth: 1,
          },
          label: { show: false },
          labelLine: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 8,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: 'rgba(0,0,0,0.18)',
            },
          },
          data: pieData,
          animationDuration: prefersReducedMotion ? 0 : 600,
          animationEasing: 'cubicOut',
        },
      ],
    }),
    [pieData, mode, prefersReducedMotion],
  );

  // Hover a table row → tell echarts to highlight the matching slice
  const highlightSlice = useCallback((idx: number | null) => {
    const chart = chartRef.current?.getEchartsInstance?.();
    if (!chart) return;
    if (idx == null) {
      chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
      return;
    }
    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
  }, []);

  // Hover a pie slice → highlight the row
  const onChartEvents = useMemo(
    () => ({
      mouseover: (e: any) => {
        if (typeof e?.dataIndex === 'number') setHoverIdx(e.dataIndex);
      },
      mouseout: () => setHoverIdx(null),
      click: (e: any) => {
        const id = e?.data?.areaId;
        if (id) setExpandedAreaId((prev) => (prev === id ? null : id));
      },
    }),
    [],
  );

  const PANEL_HEIGHT_LG = 520;

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div
          className="flex items-center justify-center rounded-xl bg-card p-2 sm:p-4 ring-1 ring-border/60 h-[260px] lg:h-auto"
          style={{ minHeight: undefined }}
          {...(typeof window !== 'undefined' && window.innerWidth >= 1024 ? { style: { height: PANEL_HEIGHT_LG } } : {})}
        >
          <ReactEChartsCore
            ref={chartRef}
            echarts={echarts}
            option={option}
            style={{ height: '100%', width: '100%' }}
            onEvents={onChartEvents}
            aria-label={`Budgetfördelning ${year}`}
          />
        </div>
      </div>

      <div className="lg:col-span-3">
        <div
          className="relative overflow-hidden rounded-xl bg-card ring-1 ring-border/60"
          style={typeof window !== 'undefined' && window.innerWidth >= 1024 ? { height: PANEL_HEIGHT_LG } : { maxHeight: 420 }}
        >
          <div className="h-full overflow-y-auto pr-1 [scrollbar-gutter:stable] [scrollbar-color:theme(colors.border)_transparent]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 sm:px-3 py-2 font-medium">#</th>
                <th className="px-2 sm:px-3 py-2 font-medium">{t('explorer.table.area')}</th>
                <th className="px-2 sm:px-3 py-2 font-medium text-right">{t('explorer.amount')}</th>
                <th className="px-2 sm:px-3 py-2 font-medium text-right hidden sm:table-cell">{t('explorer.share')}</th>
                <th className="px-1 sm:px-2 py-2 hidden sm:table-cell" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isHover = hoverIdx === i;
                const isExpanded = expandedAreaId === r.area.area_id;
                const color = stableColor(r.area.name_sv);
                return (
                  <Fragment key={r.area.area_id}>
                    <tr
                      onMouseEnter={() => {
                        setHoverIdx(i);
                        highlightSlice(i);
                      }}
                      onMouseLeave={() => {
                        setHoverIdx(null);
                        highlightSlice(null);
                      }}
                      onClick={() =>
                        setExpandedAreaId((prev) => (prev === r.area.area_id ? null : r.area.area_id))
                      }
                      className={cn(
                        'cursor-pointer border-t border-border/50 transition-colors',
                        isHover && 'bg-primary/5',
                        isExpanded && 'bg-primary/10',
                      )}
                    >
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-foreground truncate text-xs sm:text-sm">{localizeArea(r.area.name_sv)}</span>
                        </div>
                      </td>
                      <td className="px-2 sm:px-3 py-2 sm:py-2.5 text-right tabular-nums whitespace-nowrap text-xs sm:text-sm">
                        {mkr(r.rawAmount)}
                      </td>
                      <td className="px-2 sm:px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                        {r.pct.toFixed(1)}%
                      </td>
                      <td className="px-1 sm:px-2 py-2.5 text-muted-foreground hidden sm:table-cell">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={5} className="px-3 sm:px-4 py-3 sm:py-4">
                          <AnslagBreakdown
                            areaId={r.area.area_id}
                            areaName={r.area.name_sv}
                            year={year}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
          />
        </div>
      </div>

      <div className="lg:col-span-5">
        <SourceLink sources="ESV" />
      </div>
    </div>
  );
};

interface AnslagBreakdownProps {
  areaId: number;
  areaName: string;
  year: number;
}

const AnslagBreakdown = ({ areaId, areaName, year }: AnslagBreakdownProps) => {
  const { t } = useTranslation();
  const localizeArea = useAreaName();
  const lang = useActiveLang();
  const mkr = (n: number) => formatMkrLocalized(n, lang);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { data, isLoading } = useQuery({
    queryKey: ['anslag', year, areaId],
    queryFn: () => getBudgetByYear(year, 'anslag', areaId),
  });
  const { data: anslagMeta } = useQuery({
    queryKey: ['dim_anslag', areaId],
    queryFn: () => getAnslagByArea(areaId),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const nameById = new Map<number, { code: string; name: string }>();
    (anslagMeta ?? []).forEach((a) => nameById.set(a.anslag_id, { code: a.code, name: a.name_sv }));
    return data
      .filter((f) => f.anslag_id != null && f.budget_type !== 'shadow_delta')
      .map((f) => {
        const meta = nameById.get(f.anslag_id!);
        return {
          id: f.anslag_id!,
          name: meta ? `${meta.code} · ${meta.name}` : `Anslag ${f.anslag_id}`,
          amount: f.amount_nominal_sek, // Mkr
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [data, anslagMeta]);

  const areaTotal = rows.reduce((s, r) => s + r.amount, 0);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('explorer.anslag.loading')}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('explorer.anslag.empty')}</p>;
  }

  const pieData = rows.map((r) => ({
    name: r.name,
    value: r.amount,
    itemStyle: { color: stableColor(r.name) },
  }));

  const option: echarts.EChartsCoreOption = {
    color: ECHARTS_COLOR_ARRAY,
    tooltip: {
      trigger: 'item',
      confine: true,
      backgroundColor: CHROME.surface,
      borderColor: CHROME.border,
      extraCssText: 'max-width:260px; white-space:normal; word-break:break-word; box-shadow:0 4px 16px rgba(0,0,0,0.08);',
      textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
      formatter: (p: any) =>
        `<div style="max-width:240px;line-height:1.4"><strong style="display:block;margin-bottom:4px">${p.name}</strong>${mkr(p.value)} · ${((p.value / areaTotal) * 100).toFixed(1)}%</div>`,
    },
    series: [
      {
        type: 'pie',
        radius: ['30%', '72%'],
        center: ['50%', '50%'],
        minAngle: 3,
        padAngle: 0.5,
        itemStyle: { borderRadius: 2, borderColor: CHROME.bg, borderWidth: 1 },
        label: { show: false },
        labelLine: { show: false },
        data: pieData,
        animationDuration: prefersReducedMotion ? 0 : 400,
      },
    ],
  };

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="md:col-span-2">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t('explorer.anslag.heading', { area: localizeArea(areaName) })}
        </p>
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: '260px', width: '100%' }}
          aria-label={`Anslag i ${areaName}`}
        />
      </div>
      <div className="md:col-span-3">
        <ul className="divide-y divide-border/50">
          {rows.map((r) => {
            const pct = areaTotal > 0 ? (r.amount / areaTotal) * 100 : 0;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-1.5 text-sm"
                title={r.name}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: stableColor(r.name) }}
                  />
                  <span className="truncate text-foreground">{r.name}</span>
                </div>
                <div className="flex items-baseline gap-2 shrink-0 tabular-nums">
                  <span className="text-foreground">{mkr(r.amount)}</span>
                  <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default BudgetPieTable;
