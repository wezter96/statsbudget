import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { BUDGET_EVENTS } from '@/lib/events';
import { formatAmount } from '@/lib/budget-queries';
import { ECHARTS_COLOR_ARRAY, CHROME, stableColor } from '@/lib/palette';
import { buildTimeSeriesLegendItems } from '@/lib/time-series-legend';
import SourceLink from '@/components/SourceLink';
import type { DisplayMode } from '@/lib/supabase-types';

echarts.use([LineChart, TooltipComponent, GridComponent, CanvasRenderer]);

interface SeriesData {
  name: string;
  /** Stable language-independent key for color lookup. Falls back to `name`. */
  colorKey?: string;
  data: { year: number; value: number }[];
  color?: string;
  sortValue?: number;
}

interface TimeSeriesChartProps {
  series: SeriesData[];
  mode: DisplayMode;
  yearFrom: number;
  yearTo: number;
}

const TimeSeriesChart = ({ series, mode, yearFrom, yearTo }: TimeSeriesChartProps) => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const legendItems = useMemo(() => buildTimeSeriesLegendItems(series, yearTo), [series, yearTo]);

  const years = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearFrom + i);

  const markLineData = years
    .filter(y => BUDGET_EVENTS[y])
    .map(y => ({
      xAxis: y.toString(),
      label: {
        formatter: BUDGET_EVENTS[y],
        fontSize: 10,
        fontFamily: 'Inter',
        color: CHROME.textMuted,
      },
      lineStyle: { color: CHROME.border, type: 'dashed' as const },
    }));

  const echartsSeriesData = series.map((s, i) => {
    const color = s.color ?? stableColor(s.colorKey ?? s.name);
    return {
      name: s.name,
      type: 'line' as const,
      stack: series.length > 1 ? 'total' : undefined,
      data: years.map(y => {
        const point = s.data.find(d => d.year === y);
        return point ? point.value : 0;
      }),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: series.length > 1 ? 1 : 2, color },
      itemStyle: { color },
      areaStyle: series.length > 1 ? { color, opacity: 0.55 } : undefined,
      ...(i === 0 && markLineData.length > 0 ? {
        markLine: {
          silent: true,
          data: markLineData,
          symbol: 'none',
        },
      } : {}),
    };
  });

  const option: echarts.EChartsCoreOption = {
    color: ECHARTS_COLOR_ARRAY,
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: CHROME.surface,
      borderColor: CHROME.border,
      extraCssText: 'max-width:340px; white-space:normal; word-break:break-word; box-shadow:0 4px 16px rgba(0,0,0,0.08);',
      textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const total = params.reduce((s: number, p: any) => s + (Number(p.value) || 0), 0);
        const sorted = [...params]
          .filter((p: any) => Number(p.value) > 0)
          .sort((a: any, b: any) => Number(b.value) - Number(a.value));
        const TOP = 8;
        const top = sorted.slice(0, TOP);
        const restCount = sorted.length - top.length;
        const restSum = sorted.slice(TOP).reduce((s: number, p: any) => s + Number(p.value), 0);

        const header = `<div style="margin-bottom:6px"><strong style="font-family:Fraunces,serif">${params[0]?.axisValue}</strong>${series.length > 1 ? ` · Totalt ${formatAmount(total, mode)}` : ''}</div>`;
        const rowHtml = top
          .map((p: any) => {
            const name = p.seriesName && p.seriesName.length > 32 ? p.seriesName.slice(0, 31) + '…' : p.seriesName;
            return `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.5"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="color:${p.color}">●</span> ${name}</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums;color:${CHROME.textMuted}">${formatAmount(p.value, mode)}</span></div>`;
          })
          .join('');
        const rest = restCount > 0
          ? `<div style="margin-top:4px;padding-top:4px;border-top:1px solid ${CHROME.border};display:flex;justify-content:space-between;gap:10px;color:${CHROME.textMuted}"><span>+${restCount} fler</span><span style="font-variant-numeric:tabular-nums">${formatAmount(restSum, mode)}</span></div>`
          : '';
        return `<div style="max-width:320px">${header}${rowHtml}${rest}</div>`;
      },
    },
    grid: {
      left: window.innerWidth < 640 ? 40 : 60,
      right: window.innerWidth < 640 ? 8 : 20,
      top: 20,
      bottom: 36,
    },
    xAxis: {
      type: 'category',
      data: years.map(String),
      axisLabel: {
        fontFamily: 'Inter',
        fontSize: window.innerWidth < 640 ? 10 : 11,
        color: CHROME.textMuted,
        interval: window.innerWidth < 640 ? Math.max(1, Math.floor(years.length / 6)) : undefined,
      },
      axisLine: { lineStyle: { color: CHROME.border } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: 'Inter',
        fontSize: 11,
        color: CHROME.textMuted,
        formatter: (v: number) => formatAmount(v, mode),
      },
      splitLine: { lineStyle: { color: CHROME.border } },
    },
    series: echartsSeriesData,
    animationDuration: prefersReducedMotion ? 0 : 800,
  };

  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge={true}
        lazyUpdate={false}
        style={{ height: window.innerWidth < 640 ? '280px' : '400px', width: '100%' }}
        aria-label="Tidsserie över budgetdata"
      />
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {legendItems.map((item) => (
          <li key={item.name} className="flex items-center gap-2">
            <span className="relative inline-block h-3 w-5 shrink-0" aria-hidden="true">
              <span
                className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2"
                style={{ backgroundColor: item.color }}
              />
              <span
                className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </span>
            <span>{item.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2"><SourceLink sources="ESV" /></div>
    </div>
  );
};

export default TimeSeriesChart;
