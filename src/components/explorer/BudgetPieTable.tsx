import { Fragment, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { stableColor, CHROME, ECHARTS_COLOR_ARRAY } from '@/lib/palette';
import { useAreaName, useActiveLang, formatMkrLocalized, formatMkrCompact } from '@/lib/area-i18n';
import { cn } from '@/lib/utils';
import { formatAmount, getBudgetByYear, getAnslagByArea } from '@/lib/budget-queries';
import SourceLink from '@/components/SourceLink';
import type { DimArea, DimYear, DisplayMode } from '@/lib/supabase-types';

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

type PieTooltipParam = {
  name: string;
  value: number;
  percent: number;
};

type PieEventParam = {
  dataIndex?: number;
  data?: {
    areaId?: number;
  };
};

export interface PieRow {
  area: DimArea;
  value: number;
  rawAmount: number;
  pct: number;
  changePct?: number | null;
  compareRawAmount?: number | null;
  compareValue?: number;
}

interface Props {
  rows: PieRow[];
  mode: DisplayMode;
  year: number;
  yearData?: DimYear;
  compareActive?: boolean;
  compareYear?: number | null;
  allowBreakdown?: boolean;
  categoryLabel?: string;
  sourceLabel?: string;
  renderDetail?: (row: PieRow) => ReactNode;
}

const BudgetPieTable = ({
  rows,
  mode,
  year,
  yearData: _yearData,
  compareActive,
  compareYear,
  allowBreakdown = true,
  categoryLabel,
  sourceLabel = 'ESV',
  renderDetail,
}: Props) => {
  const { t } = useTranslation();
  const localizeArea = useAreaName();
  const lang = useActiveLang();
  const mkr = (n: number) => formatMkrLocalized(n, lang);
  const mkrShort = (n: number) => formatMkrCompact(n, lang);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chartRef = useRef<ReactEChartsCore | null>(null);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [expandedAreaId, setExpandedAreaId] = useState<number | null>(null);
  const detailColSpan = compareActive
    ? (allowBreakdown ? 6 : 5)
    : (allowBreakdown ? 5 : 4);

  const pieData = useMemo(
    () =>
      rows.map((r) => ({
        name: localizeArea(r.area.name_sv),
        value: r.value,
        areaId: r.area.area_id,
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
        formatter: (p: PieTooltipParam) =>
          `<div style="max-width:240px;line-height:1.4"><strong style="font-family:Fraunces,serif;display:block;margin-bottom:4px">${p.name}</strong>${formatAmount(p.value, mode)} · ${p.percent}%</div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '74%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          minAngle: 3,
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

  const onChartEvents = useMemo(
    () => ({
      mouseover: (e: PieEventParam) => {
        if (typeof e?.dataIndex === 'number') setHoverIdx(e.dataIndex);
      },
      mouseout: () => setHoverIdx(null),
      click: (e: PieEventParam) => {
        if (!allowBreakdown) return;
        const id = e?.data?.areaId;
        if (id) setExpandedAreaId((prev) => (prev === id ? null : id));
      },
    }),
    [allowBreakdown],
  );

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 min-w-0">
        <div className="flex items-center justify-center rounded-xl bg-card p-2 sm:p-4 ring-1 ring-border/60 h-[260px] sm:h-[300px] lg:h-[520px] overflow-hidden">
          <ReactEChartsCore
            ref={chartRef}
            echarts={echarts}
            option={option}
            style={{ height: '100%', width: '100%' }}
            onEvents={onChartEvents}
            // @ts-expect-error echarts-for-react spreads extra props to the wrapper div
            role="img"
            aria-label={`Budgetfördelning ${year}`}
          />
        </div>
      </div>

      <div className="lg:col-span-3 min-w-0">
        <div className="rounded-xl bg-card ring-1 ring-border/60 max-h-[70vh] sm:max-h-[520px] lg:max-h-none lg:h-[520px] overflow-y-auto overflow-x-hidden relative">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              {!compareActive ? (
                <>
                  <col className="w-7 sm:w-10" />
                  <col />
                  <col className="w-[5.5rem] sm:w-40" />
                  <col className="w-11 sm:w-20" />
                  {allowBreakdown && <col className="w-0 sm:w-8" />}
                </>
              ) : (
                <>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '15%' }} />
                  {allowBreakdown && <col style={{ width: '5%' }} className="hidden sm:table-column" />}
                </>
              )}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-normal sm:tracking-wide text-muted-foreground">
                <th className="px-1.5 sm:px-3 py-2 font-medium">#</th>
                <th className="px-1.5 sm:px-3 py-2 font-medium">
                  <span className="sm:hidden">{categoryLabel ?? t('explorer.table.areaShort')}</span>
                  <span className="hidden sm:inline">{categoryLabel ?? t('explorer.table.area')}</span>
                </th>
                <th className="px-1.5 sm:px-3 py-2 font-medium text-right">
                  {compareActive ? year : (
                    <>
                      <span className="sm:hidden">{t('explorer.amountShort')}</span>
                      <span className="hidden sm:inline">{t('explorer.amount')}</span>
                    </>
                  )}
                </th>
                {compareActive && (
                  <th className="px-1.5 sm:px-3 py-2 font-medium text-right">
                    {compareYear}
                  </th>
                )}
                {compareActive ? (
                  <th className="px-1.5 sm:px-3 py-2 font-medium text-right">
                    <span className="sm:hidden">{t('explorer.changeShort')}</span>
                    <span className="hidden sm:inline">{t('explorer.change')}</span>
                  </th>
                ) : (
                  <th className="px-1.5 sm:px-3 py-2 font-medium text-right">
                    <span className="sm:hidden">{t('explorer.shareShort')}</span>
                    <span className="hidden sm:inline">{t('explorer.share')}</span>
                  </th>
                )}
                {allowBreakdown && (
                  <th className={cn('px-1 sm:px-2 py-2 hidden sm:table-cell', compareActive && 'sm:w-[4%]')} aria-hidden="true" />
                )}
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
                      onClick={allowBreakdown
                        ? () => setExpandedAreaId((prev) => (prev === r.area.area_id ? null : r.area.area_id))
                        : undefined}
                      onKeyDown={allowBreakdown
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setExpandedAreaId((prev) => (prev === r.area.area_id ? null : r.area.area_id));
                            }
                          }
                        : undefined}
                      tabIndex={allowBreakdown ? 0 : undefined}
                      role={allowBreakdown ? 'button' : undefined}
                      aria-expanded={allowBreakdown ? isExpanded : undefined}
                      className={cn(
                        'border-t border-border/50 transition-colors',
                        allowBreakdown && 'cursor-pointer row-press',
                        isHover && 'bg-primary/5',
                        isExpanded && 'bg-primary/10',
                      )}
                    >
                      <td className="px-1.5 sm:px-3 py-2 sm:py-2.5 text-muted-foreground tabular-nums text-xs">{i + 1}</td>
                      <td className="px-1.5 sm:px-3 py-2 sm:py-2.5">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                          <span
                            aria-hidden="true"
                            className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-foreground truncate text-xs sm:text-sm" title={localizeArea(r.area.name_sv)}>{localizeArea(r.area.name_sv)}</span>
                        </div>
                      </td>
                      <td className={cn(
                        'px-1.5 sm:px-3 py-2 sm:py-2.5 text-right tabular-nums text-[11px] sm:text-sm',
                        compareActive && 'overflow-hidden text-ellipsis whitespace-nowrap',
                      )}>
                        {compareActive ? (
                          <>
                            <span className="sm:hidden">{mkrShort(r.rawAmount)}</span>
                            <span className="hidden sm:inline">{mkr(r.rawAmount)}</span>
                          </>
                        ) : (
                          <div className="flex flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:justify-end sm:gap-1.5">
                            <span className="whitespace-nowrap">{mkr(r.rawAmount)}</span>
                            {r.changePct != null && (
                              <span className={cn(
                                'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-medium leading-none',
                                r.changePct > 0 ? 'bg-green-100 text-green-700' : r.changePct < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
                              )}>
                                {r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      {compareActive && (
                        <td className="px-1.5 sm:px-3 py-2 sm:py-2.5 text-right tabular-nums overflow-hidden text-ellipsis whitespace-nowrap text-[11px] sm:text-sm text-muted-foreground">
                          {r.compareRawAmount != null ? (
                            <>
                              <span className="sm:hidden">{mkrShort(r.compareRawAmount)}</span>
                              <span className="hidden sm:inline">{mkr(r.compareRawAmount)}</span>
                            </>
                          ) : '—'}
                        </td>
                      )}
                      {compareActive ? (
                        <td className="px-1.5 sm:px-3 py-2.5 text-right tabular-nums text-[11px] sm:text-sm">
                          {r.changePct != null ? (
                            <span className={cn(
                              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs font-medium leading-none',
                              r.changePct > 0 ? 'bg-green-100 text-green-700' : r.changePct < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
                            )}>
                              {r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%
                            </span>
                          ) : '—'}
                        </td>
                      ) : (
                        <td className="px-1.5 sm:px-3 py-2.5 text-right tabular-nums text-muted-foreground text-[11px] sm:text-sm">
                          {r.pct.toFixed(1)}%
                        </td>
                      )}
                      {allowBreakdown && (
                        <td className="px-1 sm:px-2 py-2.5 text-muted-foreground hidden sm:table-cell">
                          <ChevronDown aria-hidden="true" className={cn('h-4 w-4 transition-transform duration-200', !isExpanded && '-rotate-90')} />
                        </td>
                      )}
                    </tr>
                    {allowBreakdown && (
                      <tr>
                        <td colSpan={detailColSpan} className="p-0 border-0">
                          <div
                            className={cn(
                              'grid transition-[grid-template-rows] duration-300 ease-in-out',
                              isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                            )}
                          >
                            <div className="overflow-hidden">
                              <div className="bg-muted/30 px-3 sm:px-4 py-3 sm:py-4">
                                {renderDetail ? renderDetail(r) : (
                                  <AnslagBreakdown
                                    areaId={r.area.area_id}
                                    areaName={r.area.name_sv}
                                    year={year}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div
            aria-hidden="true"
            className="pointer-events-none sticky inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent"
          />
        </div>
      </div>

      <div className="lg:col-span-5">
        <SourceLink sources={sourceLabel} />
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
          amount: f.amount_nominal_sek,
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
      formatter: (p: { name: string; value: number }) =>
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
      <div className="md:col-span-2 min-w-0 overflow-hidden">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t('explorer.anslag.heading', { area: localizeArea(areaName) })}
        </p>
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: '180px', width: '100%' }}
          // @ts-expect-error echarts-for-react spreads extra props to wrapper div
          role="img"
          aria-label={`Anslag i ${areaName}`}
        />
      </div>
      <div className="md:col-span-3 min-w-0">
        <ul className="divide-y divide-border/50">
          {rows.map((r) => {
            const pct = areaTotal > 0 ? (r.amount / areaTotal) * 100 : 0;
            return (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 py-1.5 text-xs sm:text-sm"
                title={r.name}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: stableColor(r.name) }}
                  />
                  <span className="truncate text-foreground">{r.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2 shrink-0 tabular-nums whitespace-nowrap">
                  <span className="text-foreground">{mkr(r.amount)}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{pct.toFixed(1)}%</span>
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
