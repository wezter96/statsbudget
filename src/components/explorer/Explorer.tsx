import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getYears, getBudgetYears, getAreas, getBudgetByYear, getAllTimeSeries,
  getAreaTimeSeries, convertAmount, formatAmount,
} from '@/lib/budget-queries';
import type { DisplayMode, DimYear, DimArea, FactBudget } from '@/lib/supabase-types';
import ModeSelector from './ModeSelector';
import YearPicker from './YearPicker';
import YearRangeSlider from './YearRangeSlider';
import BudgetPieTable from './BudgetPieTable';
import CategoryFilter from './CategoryFilter';
import TimeSeriesChart from './TimeSeriesChart';
import BudgetBalanceChart from './BudgetBalanceChart';
import PartyBudgetComparison from './PartyBudgetComparison';
import { TreemapSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { useActiveLang, formatMkrLocalized, localizeAreaName } from '@/lib/area-i18n';

const Explorer = () => {
  const { t } = useTranslation();
  const lang = useActiveLang();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const urlYear = searchParams.get('year');
  const urlMode = searchParams.get('mode') as DisplayMode | null;
  const urlArea = searchParams.get('area');
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');
  const urlAreas = searchParams.get('areas');

  const [mode, setMode] = useState<DisplayMode>(urlMode || 'total_pct');
  // selectedYear + yearTo start at 0 and get hydrated to the latest year once
  // budgetYears loads. Using 0 avoids an initial fetch of a stale hardcoded year.
  const [selectedYear, setSelectedYear] = useState<number>(urlYear ? Number(urlYear) : 0);
  const [selectedAreaId, setSelectedAreaId] = useState<number | undefined>(urlArea ? Number(urlArea) : undefined);
  const [yearFrom, setYearFrom] = useState(urlFrom ? Number(urlFrom) : 0);
  const [yearTo, setYearTo] = useState(urlTo ? Number(urlTo) : 0);
  // When `undefined` it means "not yet hydrated"; hydrate to all area IDs once
  // areas load, unless URL provides a specific subset.
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[] | undefined>(
    urlAreas ? urlAreas.split(',').map(Number).filter(Boolean) : undefined
  );

  // Data queries
  const { data: years } = useQuery({ queryKey: ['years'], queryFn: getYears });
  const { data: budgetYears } = useQuery({ queryKey: ['budget_years'], queryFn: getBudgetYears });
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: getAreas });

  // Sync state to URL — skip placeholder 0 values until they hydrate
  useEffect(() => {
    if (!selectedYear || !yearTo || !areas || selectedCategoryIds === undefined) return;
    const params: Record<string, string> = { year: String(selectedYear), mode };
    if (selectedAreaId) params.area = String(selectedAreaId);
    params.from = String(yearFrom);
    params.to = String(yearTo);
    // Only write `areas` when it's a genuine subset (not all selected)
    if (selectedCategoryIds.length > 0 && selectedCategoryIds.length < areas.length) {
      params.areas = selectedCategoryIds.join(',');
    }
    setSearchParams(params, { replace: true });
  }, [selectedYear, mode, selectedAreaId, yearFrom, yearTo, selectedCategoryIds, areas, setSearchParams]);

  // Only expose years that actually have fact_budget rows — hides SCB-only years
  const regularYears = useMemo(() => budgetYears ?? [], [budgetYears]);

  useEffect(() => {
    if (regularYears.length === 0) return;
    const earliest = regularYears[0];
    const latest = regularYears[regularYears.length - 1];
    if (!urlYear || !selectedYear) setSelectedYear(latest);
    if (!urlFrom || !yearFrom) setYearFrom(earliest);
    if (!urlTo || !yearTo) setYearTo(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regularYears]);

  // Hydrate selected categories to "all" once areas load
  useEffect(() => {
    if (!areas || selectedCategoryIds !== undefined) return;
    setSelectedCategoryIds(areas.map((a) => a.area_id));
  }, [areas, selectedCategoryIds]);

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
    enabled: yearFrom > 0 && yearTo > 0,
  });


  // Pie/treemap data — one row per utgiftsområde for the selected year
  const pieRows = useMemo(() => {
    if (!govBudgetData.length || !areas || !yearData) return [];
    return govBudgetData
      .filter(f => areas.some(a => a.area_id === f.area_id))
      .map(f => {
        const area = areas.find(a => a.area_id === f.area_id)!;
        return {
          area,
          value: convertAmount(f.amount_nominal_sek, mode, yearData, totalForYear),
          rawAmount: f.amount_nominal_sek,
          pct: totalForYear ? (f.amount_nominal_sek / totalForYear) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [govBudgetData, areas, yearData, mode, totalForYear]);

  // Time series data — respects the category filter
  const timeChartSeries = useMemo(() => {
    if (!timeSeriesData || !areas || !years) return [];
    const filterSet = selectedCategoryIds ? new Set(selectedCategoryIds) : null;
    const grouped: Record<number, { data: { year: number; value: number }[]; sortValue: number }> = {};
    timeSeriesData.forEach(f => {
      if (f.budget_type === 'shadow_delta') return;
      if (filterSet && !filterSet.has(f.area_id)) return;
      if (!grouped[f.area_id]) grouped[f.area_id] = { data: [], sortValue: 0 };
      const yd = years.find(y => y.year_id === f.year_id);
      if (!yd) return;
      const allForYear = timeSeriesData.filter(ff => ff.year_id === f.year_id && ff.budget_type !== 'shadow_delta');
      const total = allForYear.reduce((s, ff) => s + ff.amount_nominal_sek, 0);
      grouped[f.area_id].data.push({
        year: f.year_id,
        value: convertAmount(f.amount_nominal_sek, mode, yd, total),
      });
      if (f.year_id === yearTo) {
        grouped[f.area_id].sortValue = total ? (f.amount_nominal_sek / total) * 100 : 0;
      }
    });
    return Object.entries(grouped).map(([areaId, entry]) => {
      const sv = areas.find(a => a.area_id === Number(areaId))?.name_sv || '';
      return {
        name: localizeAreaName(sv, lang),
        colorKey: sv,
        data: entry.data,
        sortValue: entry.sortValue,
      };
    });
  }, [timeSeriesData, areas, years, mode, selectedCategoryIds, lang]);

  // Ranked area ids by current-year spend — used by "Topp N" presets in the filter
  const rankedAreaIds = useMemo(() => pieRows.map((r) => r.area.area_id), [pieRows]);


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
        {/* Breadcrumb */}
        {breadcrumb && (
          <div className="mb-4 flex items-center gap-2 text-sm">
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
        <div className="space-y-12">
          {/* Primary view: Fördelning — pie + table, controlled by year dropdown */}
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {t('explorer.distribution')} {selectedYear || ''}
                </h2>
                {totalForYear > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {t('explorer.totalBudget')}:{' '}
                    <span className="font-display text-base font-semibold text-foreground tabular-nums">
                      {formatMkrLocalized(totalForYear, lang)}
                    </span>
                  </span>
                )}
                {(yearData?.riksdagen_proposition_url || yearData?.riksdagen_decision_url) && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{t('explorer.verifyAt')}</span>
                    {yearData?.riksdagen_proposition_url && (
                      <a
                        href={yearData.riksdagen_proposition_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 hover:text-primary hover:underline"
                        title={yearData.riksdagen_proposition_title ?? undefined}
                      >
                        {t('explorer.budgetProposition')}
                        <span aria-hidden="true">↗</span>
                      </a>
                    )}
                    {yearData?.riksdagen_decision_url && (
                      <a
                        href={yearData.riksdagen_decision_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 hover:text-primary hover:underline"
                        title={yearData.riksdagen_decision_title ?? undefined}
                      >
                        {t('explorer.financeCommittee')}
                        <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
              <YearPicker
                years={regularYears}
                selectedYear={selectedYear}
                onChange={setSelectedYear}
              />
            </div>

            {budgetLoading ? (
              <TreemapSkeleton />
            ) : pieRows.length > 0 ? (
              <BudgetPieTable
                rows={pieRows}
                mode={mode}
                year={selectedYear}
                yearData={yearData}
              />
            ) : (
              <p className="text-center text-muted-foreground py-12">{t('explorer.noData')}</p>
            )}
          </div>

          {/* Politik section: budget balance + party comparison */}
          <div className="space-y-10 rounded-xl bg-muted/30 p-3 sm:p-6 ring-1 ring-border/60">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {t('explorer.politicsHeading')}
            </h2>
            <BudgetBalanceChart />
            <PartyBudgetComparison />
          </div>

          {/* Secondary view: time series over year range, with its own controls */}
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t('explorer.overTime')} {yearFrom || ''}–{yearTo || ''}
              </h2>
              {areas && areas.length > 0 && selectedCategoryIds !== undefined && (
                <CategoryFilter
                  areas={areas}
                  selected={selectedCategoryIds}
                  onChange={setSelectedCategoryIds}
                  rankedAreaIds={rankedAreaIds}
                />
              )}
            </div>

            {/* Time series controls row */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-card/60 p-3 ring-1 ring-border/60">
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
            </div>

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
      </div>
    </section>
  );
};

export default Explorer;
