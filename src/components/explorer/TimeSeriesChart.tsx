import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { BUDGET_EVENTS } from '@/lib/events';
import { formatAmount } from '@/lib/budget-queries';
import type { DisplayMode } from '@/lib/supabase-types';

echarts.use([LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface SeriesData {
  name: string;
  data: { year: number; value: number }[];
  color?: string;
}

interface TimeSeriesChartProps {
  series: SeriesData[];
  mode: DisplayMode;
  yearFrom: number;
  yearTo: number;
}

const TimeSeriesChart = ({ series, mode, yearFrom, yearTo }: TimeSeriesChartProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const years = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearFrom + i);

  const markLineData = years
    .filter(y => BUDGET_EVENTS[y])
    .map(y => ({
      xAxis: y.toString(),
      label: {
        formatter: BUDGET_EVENTS[y],
        fontSize: 10,
        fontFamily: 'Inter',
        color: '#6B635A',
      },
      lineStyle: { color: '#E8E2D6', type: 'dashed' as const },
    }));

  const echartsSeriesData = series.map((s, i) => ({
    name: s.name,
    type: 'line' as const,
    stack: series.length > 1 ? 'total' : undefined,
    areaStyle: series.length > 1 ? { opacity: 0.6 } : undefined,
    data: years.map(y => {
      const point = s.data.find(d => d.year === y);
      return point ? point.value : 0;
    }),
    smooth: true,
    symbol: 'none',
    lineStyle: { width: series.length > 1 ? 1 : 2 },
    ...(s.color ? { itemStyle: { color: s.color }, areaStyle: { color: s.color, opacity: 0.4 } } : {}),
    ...(i === 0 && markLineData.length > 0 ? {
      markLine: {
        silent: true,
        data: markLineData,
        symbol: 'none',
      },
    } : {}),
  }));

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const header = `<strong>${params[0]?.axisValue}</strong><br/>`;
        const rows = params.map((p: any) =>
          `<span style="color:${p.color}">●</span> ${p.seriesName}: ${formatAmount(p.value, mode)}`
        ).join('<br/>');
        return `<div style="font-family:Inter;font-size:12px">${header}${rows}</div>`;
      },
    },
    legend: {
      show: series.length > 1 && series.length <= 10,
      bottom: 0,
      textStyle: { fontFamily: 'Inter', fontSize: 11, color: '#6B635A' },
    },
    grid: {
      left: 60,
      right: 20,
      top: 20,
      bottom: series.length > 1 ? 60 : 30,
    },
    xAxis: {
      type: 'category',
      data: years.map(String),
      axisLabel: { fontFamily: 'Inter', fontSize: 11, color: '#6B635A' },
      axisLine: { lineStyle: { color: '#E8E2D6' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: 'Inter',
        fontSize: 11,
        color: '#6B635A',
        formatter: (v: number) => formatAmount(v, mode),
      },
      splitLine: { lineStyle: { color: '#E8E2D6' } },
    },
    series: echartsSeriesData,
    animationDuration: prefersReducedMotion ? 0 : 800,
  };

  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: '400px', width: '100%' }}
        aria-label="Tidsserie över budgetdata"
      />
      <p className="mt-2 text-xs text-muted-foreground">{t('explorer.source')}</p>
    </div>
  );
};

export default TimeSeriesChart;
