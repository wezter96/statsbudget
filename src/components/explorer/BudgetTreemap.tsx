import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { TreemapChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useTranslation } from 'react-i18next';
import type { DimArea, DisplayMode } from '@/lib/supabase-types';
import { formatAmount } from '@/lib/budget-queries';

echarts.use([TreemapChart, TooltipComponent, CanvasRenderer]);

interface TreemapItem {
  area: DimArea;
  value: number;
  rawAmount: number;
}

interface BudgetTreemapProps {
  data: TreemapItem[];
  mode: DisplayMode;
  onAreaClick: (areaId: number) => void;
  selectedAreaId?: number;
}

const BudgetTreemap = ({ data, mode, onAreaClick, selectedAreaId }: BudgetTreemapProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const treemapData = data.map(item => ({
    name: item.area.name_sv,
    value: item.value,
    rawAmount: item.rawAmount,
    areaId: item.area.area_id,
    itemStyle: {
      borderColor: '#FBF9F4',
      borderWidth: 3,
      gapWidth: 2,
    },
  }));

  const option: echarts.EChartsOption = {
    tooltip: {
      formatter: (params: any) => {
        return `<div style="font-family: Inter, sans-serif; font-size: 13px;">
          <strong>${params.name}</strong><br/>
          ${formatAmount(params.value, mode)}
        </div>`;
      },
    },
    series: [{
      type: 'treemap',
      data: treemapData,
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: {
        show: true,
        fontFamily: 'Inter',
        fontSize: 12,
        color: '#1F1B16',
        formatter: '{b}',
      },
      upperLabel: { show: false },
      itemStyle: {
        borderColor: '#FBF9F4',
        borderWidth: 3,
        gapWidth: 2,
        borderRadius: 6,
      },
      levels: [{
        itemStyle: {
          borderColor: '#FBF9F4',
          borderWidth: 4,
          gapWidth: 3,
          borderRadius: 8,
        },
        color: [
          '#A14D3A', '#C4836E', '#D4A08E', '#8B9E8C', '#5A7A5C',
          '#B5523A', '#D1907A', '#E8C4B8', '#7A8F7C', '#9BB09C',
          '#C17A5E', '#A08070', '#887766', '#6B8A6D', '#4D6B4E',
          '#D49880', '#B08070', '#9A7060', '#7D9A7E', '#5E7E5F',
          '#C68A72', '#A97B6A', '#8C6C5C', '#6F8E70', '#527252',
          '#BE8268', '#977060', '#7B5E50',
        ],
      }],
      animationDuration: prefersReducedMotion ? 0 : 500,
    }],
  };

  const handleClick = (params: any) => {
    if (params.data?.areaId) {
      onAreaClick(params.data.areaId);
    }
  };

  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        style={{ height: '400px', width: '100%' }}
        onEvents={{ click: handleClick }}
        aria-label={t('explorer.drillDown')}
      />
      <p className="mt-2 text-xs text-muted-foreground">{t('explorer.source')}</p>
    </div>
  );
};

export default BudgetTreemap;
