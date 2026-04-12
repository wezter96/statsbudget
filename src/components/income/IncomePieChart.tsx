import { useMemo, useRef, useState, useCallback } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { stableColor, CHROME, ECHARTS_COLOR_ARRAY } from '@/lib/palette';
import { cn } from '@/lib/utils';
import type { DimIncomeTitle } from '@/lib/supabase-types';

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

export interface IncomePieRow {
  group: DimIncomeTitle;
  amount_mkr: number;
  pct: number;
}

interface Props {
  rows: IncomePieRow[];
  year: number;
  onGroupClick?: (groupId: number) => void;
}

const IncomePieChart = ({ rows, year, onGroupClick }: Props) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chartRef = useRef<any>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    if (Math.abs(v) >= 1000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr kr`;
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} ${t('skatteintakter.unit')}`;
  };

  const pieData = useMemo(
    () => rows.map((r) => ({
      name: isEn && r.group.name_en ? r.group.name_en : r.group.name_sv,
      value: r.amount_mkr,
      groupId: r.group.income_title_id,
      itemStyle: { color: stableColor(r.group.name_sv) },
    })),
    [rows, isEn],
  );

  const total = rows.reduce((s, r) => s + r.amount_mkr, 0);

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
          `<div style="max-width:240px;line-height:1.4"><strong style="font-family:Fraunces,serif;display:block;margin-bottom:4px">${p.name}</strong>${fmtMkr(p.value)} · ${p.percent}%</div>`,
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
    [pieData, prefersReducedMotion],
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
      mouseover: (e: any) => {
        if (typeof e?.dataIndex === 'number') setHoverIdx(e.dataIndex);
      },
      mouseout: () => setHoverIdx(null),
      click: (e: any) => {
        const id = e?.data?.groupId;
        if (id && onGroupClick) onGroupClick(id);
      },
    }),
    [onGroupClick],
  );

  return (
    <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2 min-w-0">
        <div className="flex items-center justify-center rounded-xl bg-card p-2 sm:p-4 ring-1 ring-border/60 h-[260px] sm:h-[300px] lg:h-[420px] overflow-hidden">
          <ReactEChartsCore
            ref={chartRef}
            echarts={echarts}
            option={option}
            style={{ height: '100%', width: '100%' }}
            onEvents={onChartEvents}
            // @ts-expect-error echarts-for-react spreads extra props to the wrapper div
            role="img"
            aria-label={`${t('skatteintakter.pieHeading')} ${year}`}
          />
        </div>
      </div>

      <div className="lg:col-span-3 min-w-0">
        <div className="rounded-xl bg-card ring-1 ring-border/60 overflow-y-auto overflow-x-hidden">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-7 sm:w-10" />
              <col />
              <col className="w-[8rem] sm:w-40" />
              <col className="w-0 sm:w-16" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-2 sm:px-3 py-2 font-medium">#</th>
                <th className="px-2 sm:px-3 py-2 font-medium">{t('skatteintakter.col.name')}</th>
                <th className="px-2 sm:px-3 py-2 font-medium text-right">{t('skatteintakter.col.amount')}</th>
                <th className="px-2 sm:px-3 py-2 font-medium text-right hidden sm:table-cell">{t('skatteintakter.col.share')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const name = isEn && r.group.name_en ? r.group.name_en : r.group.name_sv;
                const color = stableColor(r.group.name_sv);
                const isHover = hoverIdx === i;
                return (
                  <tr
                    key={r.group.income_title_id}
                    onMouseEnter={() => { setHoverIdx(i); highlightSlice(i); }}
                    onMouseLeave={() => { setHoverIdx(null); highlightSlice(null); }}
                    onClick={() => onGroupClick?.(r.group.income_title_id)}
                    className={cn(
                      'cursor-pointer border-t border-border/50 transition-colors',
                      isHover && 'bg-primary/5',
                    )}
                  >
                    <td className="px-2 sm:px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                    <td className="px-2 sm:px-3 py-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span
                          aria-hidden="true"
                          className="inline-block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-sm shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium text-foreground truncate text-xs sm:text-sm" title={name}>
                          {name}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right tabular-nums whitespace-nowrap text-xs sm:text-sm">
                      {fmtMkr(r.amount_mkr)}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {r.pct.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-right text-sm text-muted-foreground">
          {t('skatteintakter.total')}: <strong className="text-foreground">{fmtMkr(total)}</strong>
        </div>
      </div>
    </div>
  );
};

export default IncomePieChart;
