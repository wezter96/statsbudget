import { useMemo } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { ECHARTS_COLOR_ARRAY, CHROME, stableColor } from '@/lib/palette';
import SourceLink from '@/components/SourceLink';

echarts.use([LineChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface TrendSeries {
  name: string;
  colorKey: string;
  data: { year: number; value: number }[];
}

interface Props {
  series: TrendSeries[];
  yearFrom: number;
  yearTo: number;
}

const IncomeTrendChart = ({ series, yearFrom, yearTo }: Props) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    if (Math.abs(v) >= 1000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(v / 1000))} mdr`;
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} Mkr`;
  };

  const years = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => yearFrom + i);

  const echartsSeriesData = useMemo(
    () => series.map((s) => {
      const color = stableColor(s.colorKey);
      return {
        name: s.name,
        type: 'line' as const,
        stack: 'total',
        data: years.map(y => {
          const point = s.data.find(d => d.year === y);
          return point ? point.value : 0;
        }),
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1, color },
        itemStyle: { color },
        areaStyle: { color, opacity: 0.55 },
      };
    }),
    [series, years],
  );

  const option: echarts.EChartsCoreOption = useMemo(
    () => ({
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
          const header = `<div style="margin-bottom:6px"><strong style="font-family:Fraunces,serif">${params[0]?.axisValue}</strong> · ${isEn ? 'Total' : 'Totalt'} ${fmtMkr(total)}</div>`;
          const rowHtml = sorted
            .map((p: any) => {
              const name = p.seriesName && p.seriesName.length > 32 ? p.seriesName.slice(0, 31) + '\u2026' : p.seriesName;
              return `<div style="display:flex;justify-content:space-between;gap:10px;line-height:1.5"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><span style="color:${p.color}">\u25CF</span> ${name}</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums;color:${CHROME.textMuted}">${fmtMkr(p.value)}</span></div>`;
            })
            .join('');
          return `<div style="max-width:320px">${header}${rowHtml}</div>`;
        },
      },
      grid: {
        left: window.innerWidth < 640 ? 50 : 70,
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
          formatter: (v: number) => fmtMkr(v),
        },
        splitLine: { lineStyle: { color: CHROME.border } },
      },
      series: echartsSeriesData,
      animationDuration: prefersReducedMotion ? 0 : 800,
    }),
    [echartsSeriesData, years, prefersReducedMotion, isEn],
  );

  const legendItems = useMemo(
    () => series.map(s => ({
      name: s.name,
      color: stableColor(s.colorKey),
    })),
    [series],
  );

  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        notMerge={true}
        lazyUpdate={false}
        style={{ height: window.innerWidth < 640 ? '280px' : '400px', width: '100%' }}
        // @ts-expect-error echarts-for-react spreads extra props to wrapper div
        role="img"
        aria-label={t('skatteintakter.trendHeading')}
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

export default IncomeTrendChart;
