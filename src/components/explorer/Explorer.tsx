import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getYears, getAreas, getParties, getBudgetByYear, getAllTimeSeries,
  getAreaTimeSeries, getPartyComparison, convertAmount, formatAmount,
} from '@/lib/budget-queries';
import type { DisplayMode, DimYear, DimArea, DimParty, FactBudget } from '@/lib/supabase-types';
import ModeSelector from './ModeSelector';
import YearPicker from './YearPicker';
import YearRangeSlider from './YearRangeSlider';
import PartyToggle from './PartyToggle';
import BudgetTreemap from './BudgetTreemap';
import TimeSeriesChart from './TimeSeriesChart';
import DeltaBarChart from './DeltaBarChart';
import MobileBarList from './MobileBarList';
import { TreemapSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { useIsMobile } from '@/hooks/use-mobile';

const Explorer = () => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const urlYear = searchParams.get('year');
  const urlMode = searchParams.get('mode') as DisplayMode | null;
  const urlArea = searchParams.get('area');
  const urlCompare = searchParams.get('compare');
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');

  const [mode, setMode] = useState<DisplayMode>(urlMode || 'total_pct');
  const [selectedYear, setSelectedYear] = useState<number>(urlYear ? Number(urlYear) : 2024);
  const [selectedAreaId, setSelectedAreaId] = useState<number | undefined>(urlArea ? Number(urlArea) : undefined);
  const [partyCompareEnabled, setPartyCompareEnabled] = useState(!!urlCompare);
  const [selectedPartyIds, setSelectedPartyIds] = useState<number[]>(
    urlCompare ? urlCompare.split(',').map(Number).filter(Boolean) : []
  );
  const [yearFrom, setYearFrom] = useState(urlFrom ? Number(urlFrom) : 2000);
  const [yearTo, setYearTo] = useState(urlTo ? Number(urlTo) : 2024);

  // Sync state to URL
  useEffect(() => {
    const params: Record<string, string> = { year: String(selectedYear), mode };
    if (selectedAreaId) params.area = String(selectedAreaId);
    if (partyCompareEnabled && selectedPartyIds.length) params.compare = selectedPartyIds.join(',');
    params.from = String(yearFrom);
    params.to = String(yearTo);
    setSearchParams(params, { replace: true });
  }, [selectedYear, mode, selectedAreaId, partyCompareEnabled, selectedPartyIds, yearFrom, yearTo, setSearchParams]);

  // Data queries
  const { data: years } = useQuery({ queryKey: ['years'], queryFn: getYears });
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: getAreas });
  const { data: parties } = useQuery({ queryKey: ['parties'], queryFn: getParties });

  const regularYears = useMemo(() =>
    years?.filter(y => !y.is_historical).map(y => y.year_id) || [],
    [years]
  );

  useEffect(() => {
    if (regularYears.length > 0 && !urlYear) {
      const latest = regularYears[regularYears.length - 1];
      setSelectedYear(latest);
      setYearTo(latest);
    }
  }, [regularYears, urlYear]);

  const yearData = useMemo(() =>
    years?.find(y => y.year_id === selectedYear),
    [years, selectedYear]
  );

  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget', selectedYear],
    queryFn: () => getBudgetByYear(selectedYear),
    enabled: !!selectedYear,
  });

  const govBudgetData = useMemo(() =>
    budgetData?.filter(f => f.budget_type !== 'shadow_delta') || [],
    [budgetData]
  );

  const totalForYear = useMemo(() =>
    govBudgetData.reduce((sum, f) => sum + f.amount_nominal_sek, 0),
    [govBudgetData]
  );

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['timeseries', selectedAreaId, yearFrom, yearTo],
    queryFn: () => selectedAreaId
      ? getAreaTimeSeries(selectedAreaId, yearFrom, yearTo)
      : getAllTimeSeries(yearFrom, yearTo),
  });

  const { data: partyData } = useQuery({
    queryKey: ['party-comparison', selectedYear, selectedPartyIds],
    queryFn: () => getPartyComparison(selectedYear, selectedPartyIds),
    enabled: partyCompareEnabled && selectedPartyIds.length > 0,
  });

  // Treemap data
  const treemapData = useMemo(() => {
    if (!govBudgetData.length || !areas || !yearData) return [];
    return govBudgetData
      .filter(f => areas.some(a => a.area_id === f.area_id))
      .map(f => {
        const area = areas.find(a => a.area_id === f.area_id)!;
        return {
          area,
          value: convertAmount(f.amount_nominal_sek, mode, yearData, totalForYear),
          rawAmount: f.amount_nominal_sek,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [govBudgetData, areas, yearData, mode, totalForYear]);

  // Time series data
  const timeChartSeries = useMemo(() => {
    if (!timeSeriesData || !areas || !years) return [];
    const grouped: Record<number, { year: number; value: number }[]> = {};
    timeSeriesData.forEach(f => {
      if (f.budget_type === 'shadow_delta') return;
      if (!grouped[f.area_id]) grouped[f.area_id] = [];
      const yd = years.find(y => y.year_id === f.year_id);
      if (!yd) return;
      const allForYear = timeSeriesData.filter(ff => ff.year_id === f.year_id && ff.budget_type !== 'shadow_delta');
      const total = allForYear.reduce((s, ff) => s + ff.amount_nominal_sek, 0);
      grouped[f.area_id].push({
        year: f.year_id,
        value: convertAmount(f.amount_nominal_sek, mode, yd, total),
      });
    });
    return Object.entries(grouped).map(([areaId, data]) => ({
      name: areas.find(a => a.area_id === Number(areaId))?.name_sv || '',
      data,
    }));
  }, [timeSeriesData, areas, years, mode]);

  // Delta data
  const deltaData = useMemo(() => {
    if (!partyData || !govBudgetData || !areas || !parties) return [];
    return govBudgetData
      .filter(f => areas.some(a => a.area_id === f.area_id))
      .map(f => {
        const area = areas.find(a => a.area_id === f.area_id)!;
        const deltas = selectedPartyIds.map(pid => {
          const party = parties.find(p => p.party_id === pid)!;
          const shadow = partyData.find(pd => pd.area_id === f.area_id && pd.party_id === pid);
          return { party, delta: shadow?.amount_nominal_sek || 0 };
        });
        return { area, govAmount: f.amount_nominal_sek, deltas };
      })
      .sort((a, b) => b.govAmount - a.govAmount);
  }, [partyData, govBudgetData, areas, parties, selectedPartyIds]);

  const handleAreaClick = useCallback((areaId: number) => {
    setSelectedAreaId(prev => prev === areaId ? undefined : areaId);
  }, []);

  const breadcrumb = useMemo(() => {
    if (!selectedAreaId || !areas) return null;
    const area = areas.find(a => a.area_id === selectedAreaId);
    return area?.name_sv;
  }, [selectedAreaId, areas]);

  return (
    <section id="explorer" className="py-8 sm:py-12">
      <div className="container">
        {/* Filter bar */}
        <div className="sticky top-14 z-30 -mx-4 bg-background/95 px-4 py-3 backdrop-blur border-b border-border sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <YearPicker
              years={regularYears}
              selectedYear={selectedYear}
              onChange={setSelectedYear}
            />
            <ModeSelector mode={mode} onChange={setMode} />
            {regularYears.length > 1 && (
              <YearRangeSlider
                min={regularYears[0]}
                max={regularYears[regularYears.length - 1]}
                from={yearFrom}
                to={yearTo}
                onChange={(f, t) => { setYearFrom(f); setYearTo(t); }}
              />
            )}
            {parties && (
              <PartyToggle
                enabled={partyCompareEnabled}
                onToggle={() => setPartyCompareEnabled(!partyCompareEnabled)}
                parties={parties}
                selectedPartyIds={selectedPartyIds}
                onPartiesChange={setSelectedPartyIds}
              />
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        {breadcrumb && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <button
              onClick={() => setSelectedAreaId(undefined)}
              className="text-primary hover:underline"
            >
              {t('explorer.drillDown')}
            </button>
            <span className="text-muted-foreground">›</span>
            <span className="text-foreground font-medium">{breadcrumb}</span>
          </div>
        )}

        {/* Main content */}
        <div className="mt-6">
          {partyCompareEnabled && selectedPartyIds.length > 0 ? (
            <div>
              {deltaData.length > 0 ? (
                <DeltaBarChart data={deltaData} mode={mode} />
              ) : (
                <p className="text-center text-muted-foreground py-12">{t('explorer.noData')}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Treemap / Bar list */}
              <div className="lg:col-span-3">
                {budgetLoading ? (
                  <TreemapSkeleton />
                ) : treemapData.length > 0 ? (
                  isMobile ? (
                    <MobileBarList
                      data={treemapData.map(d => ({ area: d.area, value: d.value, pct: convertAmount(d.rawAmount, 'total_pct', yearData!, totalForYear) }))}
                      mode={mode}
                      onAreaClick={handleAreaClick}
                    />
                  ) : (
                    <BudgetTreemap
                      data={treemapData}
                      mode={mode}
                      onAreaClick={handleAreaClick}
                      selectedAreaId={selectedAreaId}
                    />
                  )
                ) : (
                  <p className="text-center text-muted-foreground py-12">{t('explorer.noData')}</p>
                )}
              </div>

              {/* Time series */}
              <div className="lg:col-span-2">
                {timeSeriesLoading ? (
                  <ChartSkeleton />
                ) : timeChartSeries.length > 0 ? (
                  <TimeSeriesChart
                    series={timeChartSeries}
                    mode={mode}
                    yearFrom={yearFrom}
                    yearTo={yearTo}
                  />
                ) : (
                  <p className="text-center text-muted-foreground py-12">{t('explorer.noData')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Explorer;
