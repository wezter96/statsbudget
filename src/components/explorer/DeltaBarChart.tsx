import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import { formatAmount } from '@/lib/budget-queries';
import { CHROME } from '@/lib/palette';
import SourceLink from '@/components/SourceLink';
import type { DisplayMode, DimArea, DimParty } from '@/lib/supabase-types';

echarts.use([BarChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer]);

interface DeltaItem {
  area: DimArea;
  govAmount: number;
  deltas: { party: DimParty; delta: number }[];
}

interface DeltaBarChartProps {
  data: DeltaItem[];
  mode: DisplayMode;
}

const DeltaBarChart = ({ data, mode }: DeltaBarChartProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const categories = data.map(d => d.area.name_sv);
  const allParties = data.length > 0 ? data[0].deltas.map(d => d.party) : [];

  const series = allParties.map(party => ({
    name: party.name_sv,
    type: 'bar' as const,
    data: data.map(d => {
      const delta = d.deltas.find(dd => dd.party.party_id === party.party_id);
      return delta ? delta.delta : 0;
    }),
    itemStyle: { color: party.color_hex, borderRadius: [4, 4, 0, 0] },
  }));

  const option: echarts.EChartsCoreOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const idx = params[0]?.dataIndex;
        const item = data[idx];
        if (!item) return '';
        let html = `<div style="font-family:Inter;font-size:12px"><strong>${item.area.name_sv}</strong><br/>`;
        html += `Regering: ${formatAmount(item.govAmount, mode)}<br/>`;
        params.forEach((p: any) => {
          const sign = p.value >= 0 ? '+' : '';
          html += `<span style="color:${p.color}">●</span> ${p.seriesName}: ${sign}${formatAmount(p.value, mode)}<br/>`;
        });
        return html + '</div>';
      },
    },
    legend: {
      bottom: 0,
      textStyle: { fontFamily: 'Inter', fontSize: 11, color: CHROME.textMuted },
    },
    grid: { left: 160, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: 'value',
      axisLabel: {
        fontFamily: 'Inter',
        fontSize: 11,
        color: CHROME.textMuted,
        formatter: (v: number) => formatAmount(v, mode),
      },
      splitLine: { lineStyle: { color: CHROME.border } },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontFamily: 'Inter', fontSize: 11, color: CHROME.text, width: 140, overflow: 'truncate' },
    },
    series,
    animationDuration: prefersReducedMotion ? 0 : 600,
  };

  return (
    <div>
      <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
        {t('explorer.partyDisclaimer')}
      </p>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: Math.max(400, categories.length * 30) + 'px', width: '100%' }}
        aria-label="Partiernas budgetförslag jämfört med regeringen"
      />
      <div className="mt-2"><SourceLink sources="ESV, Riksdagen" /></div>
    </div>
  );
};

export default DeltaBarChart;
