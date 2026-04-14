import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { TooltipComponent, GridComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { SALDO_DATA } from './budget-saldo-data';
import { CHROME } from '@/lib/palette';

echarts.use([BarChart, LineChart, TooltipComponent, GridComponent, CanvasRenderer]);

const BLOC_COLORS = {
  S: '#9B1B30',
  borgerlig: '#6CB4EE',
} as const;

const SKULD_COLOR = '#8b5cf6';

const BudgetBalanceChart = () => {
  const { t } = useTranslation();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [showSkuld, setShowSkuld] = useState(true);

  const option: echarts.EChartsCoreOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: CHROME.surface,
      borderColor: CHROME.border,
      textStyle: { fontFamily: 'Inter', color: CHROME.text, fontSize: 12 },
      formatter: (params: any) => {
        const items = Array.isArray(params) ? params : [params];
        const saldoItem = items.find((p: any) => p.seriesIndex === 0);
        const skuldItem = items.find((p: any) => p.seriesIndex === 1);
        if (!saldoItem) return '';
        const row = SALDO_DATA[saldoItem.dataIndex];
        const sign = row.saldo_mdkr >= 0 ? '+' : '';
        const bloc = row.bloc === 'S' ? 'Socialdemokratisk' : 'Borgerlig';
        let html = `<strong>${row.year}</strong><br/>${bloc} regering<br/>Budgetsaldo: <strong>${sign}${row.saldo_mdkr.toFixed(1)} mdr kr</strong>`;
        if (skuldItem) {
          html += `<br/>Statsskuld: <strong>${row.skuld_mdkr.toLocaleString('sv-SE')} mdr kr</strong>`;
        }
        return html;
      },
    },
    grid: {
      left: window.innerWidth < 640 ? 36 : 60,
      right: showSkuld ? (window.innerWidth < 640 ? 40 : 60) : 8,
      top: 24,
      bottom: 36,
    },
    xAxis: {
      type: 'category',
      data: SALDO_DATA.map((r) => r.year),
      axisLabel: {
        fontSize: 11,
        interval: (idx: number) => {
          const step = window.innerWidth < 640 ? 10 : 5;
          return SALDO_DATA[idx].year % step === 0;
        },
      },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: CHROME.border } },
    },
    yAxis: [
      {
        type: 'value',
        name: 'mdr kr',
        nameTextStyle: { fontSize: 11, color: CHROME.textMuted },
        axisLabel: { fontSize: 11 },
        splitLine: { lineStyle: { color: CHROME.border, type: 'dashed' } },
      },
      ...(showSkuld ? [{
        type: 'value' as const,
        name: window.innerWidth < 640 ? 'skuld' : 'skuld mdr kr',
        nameTextStyle: { fontSize: 11, color: SKULD_COLOR, padding: [0, 0, 0, 4] },
        position: 'right' as const,
        axisLabel: { fontSize: 10, color: SKULD_COLOR },
        axisLine: { show: true, lineStyle: { color: SKULD_COLOR, opacity: 0.3 } },
        splitLine: { show: false },
      }] : []),
    ],
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
      ...(showSkuld ? [{
        type: 'line' as const,
        yAxisIndex: 1,
        data: SALDO_DATA.map((r) => r.skuld_mdkr),
        symbol: 'none',
        lineStyle: { color: SKULD_COLOR, width: 2 },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: `${SKULD_COLOR}18` },
          { offset: 1, color: `${SKULD_COLOR}02` },
        ]) },
        animationDuration: prefersReducedMotion ? 0 : 800,
        z: 0,
      }] : []),
    ],
  }), [prefersReducedMotion, showSkuld]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
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
          <button
            type="button"
            onClick={() => setShowSkuld((v) => !v)}
            className="flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-80"
            style={{ opacity: showSkuld ? 1 : 0.45 }}
          >
            <span className="inline-block h-0.5 w-2.5 rounded-full" style={{ backgroundColor: SKULD_COLOR }} />
            Statsskuld
          </button>
        </div>
      </div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: '320px', width: '100%' }}
        // @ts-expect-error echarts-for-react spreads extra props to wrapper div
        role="img"
        aria-label="Budgetbalans och statsskuld under olika regeringar"
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
        {' '}
        <a
          href="https://www.riksgalden.se/statistik/statistik-om-sveriges-statsskuld/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          Riksgälden — statsskuld.
        </a>
      </p>
    </div>
  );
};

export default BudgetBalanceChart;
