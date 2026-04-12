import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { TooltipComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { SALDO_DATA } from './budget-saldo-data';
import { CHROME } from '@/lib/palette';

echarts.use([BarChart, TooltipComponent, GridComponent, CanvasRenderer]);

const BLOC_COLORS = {
  S: '#9B1B30',
  borgerlig: '#6CB4EE',
} as const;

const BudgetBalanceChart = () => {
  const { t } = useTranslation();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const option: echarts.EChartsCoreOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: CHROME.surface,
      borderColor: CHROME.border,
      textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params;
        const row = SALDO_DATA[p.dataIndex];
        const sign = row.saldo_mdkr >= 0 ? '+' : '';
        const bloc = row.bloc === 'S' ? 'Socialdemokratisk' : 'Borgerlig';
        return `<strong>${row.year}</strong><br/>${bloc} regering<br/>Budgetsaldo: <strong>${sign}${row.saldo_mdkr.toFixed(1)} mdr kr</strong>`;
      },
    },
    grid: { left: window.innerWidth < 640 ? 40 : 60, right: 8, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: SALDO_DATA.map((r) => r.year),
      axisLabel: {
        fontSize: 11,
        interval: (idx: number) => SALDO_DATA[idx].year % 5 === 0,
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: CHROME.border } },
    },
    yAxis: {
      type: 'value',
      name: 'mdr kr',
      nameTextStyle: { fontSize: 11, color: CHROME.textMuted },
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { color: CHROME.border, type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: SALDO_DATA.map((r) => ({
          value: r.saldo_mdkr,
          itemStyle: { color: BLOC_COLORS[r.bloc] },
        })),
        barMaxWidth: 12,
        animationDuration: prefersReducedMotion ? 0 : 600,
      },
    ],
  }), [prefersReducedMotion]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {t('explorer.budgetBalance')}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLOC_COLORS.S }} />
            Socialdemokratisk
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLOC_COLORS.borgerlig }} />
            Borgerlig
          </span>
        </div>
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: '320px', width: '100%' }}
        // @ts-expect-error echarts-for-react spreads extra props to wrapper div
        role="img"
        aria-label="Budgetbalans under olika regeringar"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        <a
          href="https://www.ekonomifakta.se/sakomraden/offentlig-ekonomi/statsbudget/statsbudgetens-saldo_1209553.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {t('explorer.budgetBalanceSource')}
        </a>
      </p>
    </div>
  );
};

export default BudgetBalanceChart;
