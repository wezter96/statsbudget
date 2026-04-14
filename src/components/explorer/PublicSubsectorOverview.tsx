import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { stableColor, CHROME, ECHARTS_COLOR_ARRAY } from '@/lib/palette';
import { useActiveLang, formatMkrLocalized, useAreaName } from '@/lib/area-i18n';
import { getPublicSubsectorBudgetByYear, getPublicSubsectors } from '@/lib/budget-queries';
import type { DimArea } from '@/lib/supabase-types';

echarts.use([PieChart, TooltipComponent, CanvasRenderer]);

type PieTooltipParam = {
  name: string;
  value: number;
  percent: number;
};

interface Props {
  year: number;
  functionArea: DimArea;
}

const PublicSubsectorBreakdown = ({ year, functionArea }: Props) => {
  const { t } = useTranslation();
  const lang = useActiveLang();
  const localizeArea = useAreaName();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mkr = useCallback((n: number) => formatMkrLocalized(n, lang), [lang]);

  const { data: subsectors, isLoading: subsectorsLoading } = useQuery({
    queryKey: ['public_subsectors'],
    queryFn: getPublicSubsectors,
  });
  const { data: facts, isLoading: factsLoading } = useQuery({
    queryKey: ['public-subsector-budget-detail', year],
    queryFn: () => getPublicSubsectorBudgetByYear(year),
  });

  const rows = useMemo(() => {
    if (!subsectors || !facts) return [];

    return subsectors
      .map((subsector) => {
        const amount = facts
          .filter(
            (fact) =>
              fact.public_subsector_id === subsector.public_subsector_id
              && fact.public_function_id === functionArea.area_id,
          )
          .reduce((sum, fact) => sum + fact.amount_mkr, 0);

        return {
          id: subsector.public_subsector_id,
          code: subsector.code,
          name: lang === 'en' && subsector.name_en ? subsector.name_en : subsector.name_sv,
          amount,
        };
      })
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [facts, functionArea.area_id, lang, subsectors]);

  const grossTotal = rows.reduce((sum, row) => sum + row.amount, 0);

  const pieData = rows.map((row) => ({
    name: row.name,
    value: row.amount,
    itemStyle: { color: stableColor(row.code) },
  }));

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
          `<div style="max-width:240px;line-height:1.4"><strong style="display:block;margin-bottom:4px">${p.name}</strong>${mkr(p.value)} · ${p.percent.toFixed(1)}%</div>`,
      },
      series: [
        {
          type: 'pie',
          radius: ['32%', '72%'],
          center: ['50%', '50%'],
          minAngle: 3,
          padAngle: 0.5,
          itemStyle: {
            borderRadius: 2,
            borderColor: CHROME.bg,
            borderWidth: 1,
          },
          label: { show: false },
          labelLine: { show: false },
          data: pieData,
          animationDuration: prefersReducedMotion ? 0 : 400,
        },
      ],
    }),
    [mkr, pieData, prefersReducedMotion],
  );

  if (subsectorsLoading || factsLoading) {
    return <p className="text-sm text-muted-foreground">{t('explorer.publicBreakdown.loading')}</p>;
  }

  if (rows.length === 0 || grossTotal === 0) {
    return <p className="text-sm text-muted-foreground">{t('explorer.publicBreakdown.empty')}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <div className="md:col-span-2 min-w-0 overflow-hidden">
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t('explorer.publicBreakdown.heading', { area: localizeArea(functionArea.name_sv) })}
        </p>
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: '180px', width: '100%' }}
          // @ts-expect-error echarts-for-react spreads extra props to the wrapper div
          role="img"
          aria-label={`Delsektorer inom ${functionArea.name_sv}`}
        />
      </div>

      <div className="md:col-span-3 min-w-0">
        <ul className="divide-y divide-border/50">
          {rows.map((row) => {
            const pct = grossTotal > 0 ? (row.amount / grossTotal) * 100 : 0;
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-2 py-1.5 text-xs sm:text-sm"
                title={row.name}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: stableColor(row.code) }}
                  />
                  <span className="truncate text-foreground">{row.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5 sm:gap-2 shrink-0 tabular-nums whitespace-nowrap">
                  <span className="text-foreground">{mkr(row.amount)}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">{pct.toFixed(1)}%</span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t('explorer.publicBreakdown.note')}
        </p>
      </div>
    </div>
  );
};

export default PublicSubsectorBreakdown;
