import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  getYears,
  getBudgetYears,
  getPublicBudgetYears,
  getAreas,
  getPublicFunctions,
  getBudgetByYear,
  getPublicBudgetByYear,
  getAllTimeSeries,
  getPublicBudgetTimeSeries,
  getAreaTimeSeries,
  convertAmount,
} from '@/lib/budget-queries';
import type { BudgetScope, DisplayMode, DimArea } from '@/lib/supabase-types';
import ModeSelector from './ModeSelector';
import YearPicker from './YearPicker';
import YearRangeSlider from './YearRangeSlider';
import BudgetPieTable from './BudgetPieTable';
import PublicSubsectorBreakdown from './PublicSubsectorOverview';
import CategoryFilter from './CategoryFilter';
import TimeSeriesChart from './TimeSeriesChart';
import BudgetBalanceChart from './BudgetBalanceChart';
import PartyBudgetComparison from './PartyBudgetComparison';
import { TreemapSkeleton, ChartSkeleton } from '@/components/Skeletons';
import { cn } from '@/lib/utils';
import { useActiveLang, formatMkrLocalized, localizeAreaName } from '@/lib/area-i18n';

const Explorer = () => {
  const { t } = useTranslation();
  const lang = useActiveLang();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlYear = searchParams.get('year');
  const urlMode = searchParams.get('mode') as DisplayMode | null;
  const urlArea = searchParams.get('area');
  const urlFrom = searchParams.get('from');
  const urlTo = searchParams.get('to');
  const urlAreas = searchParams.get('areas');
  const urlCompare = searchParams.get('compare');
  const urlScope = searchParams.get('scope') as BudgetScope | null;

  const [mode, setMode] = useState<DisplayMode>(urlMode || 'total_pct');
  const [scope, setScope] = useState<BudgetScope>(urlScope === 'public_sector' ? 'public_sector' : 'state_budget');
  const [selectedYear, setSelectedYear] = useState<number>(urlYear ? Number(urlYear) : 0);
  const [selectedAreaId, setSelectedAreaId] = useState<number | undefined>(urlArea ? Number(urlArea) : undefined);
  const [yearFrom, setYearFrom] = useState(urlFrom ? Number(urlFrom) : 0);
  const [yearTo, setYearTo] = useState(urlTo ? Number(urlTo) : 0);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[] | undefined>(
    urlAreas ? urlAreas.split(',').map(Number).filter(Boolean) : undefined,
  );
  const [compareActive, setCompareActive] = useState(!!urlCompare);
  const [compareYear, setCompareYear] = useState<number | null>(urlCompare ? Number(urlCompare) : null);

  const { data: years } = useQuery({ queryKey: ['years'], queryFn: getYears });
  const { data: budgetYears } = useQuery({ queryKey: ['budget_years'], queryFn: getBudgetYears });
  const { data: publicBudgetYears } = useQuery({ queryKey: ['public_budget_years'], queryFn: getPublicBudgetYears });
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: getAreas });
  const { data: publicFunctions } = useQuery({ queryKey: ['public_functions'], queryFn: getPublicFunctions });

  const yearById = useMemo(
    () => new Map((years ?? []).map((year) => [year.year_id, year])),
    [years],
  );

  const currentCategories = useMemo<DimArea[]>(() => {
    if (scope === 'state_budget') return areas ?? [];
    return (publicFunctions ?? []).map((fn) => ({
      area_id: fn.public_function_id,
      code: fn.code,
      name_sv: fn.name_sv,
      name_en: fn.name_en ?? '',
      sort_order: fn.sort_order,
    }));
  }, [scope, areas, publicFunctions]);

  const regularYears = useMemo(
    () => (scope === 'state_budget' ? budgetYears ?? [] : publicBudgetYears ?? []),
    [scope, budgetYears, publicBudgetYears],
  );

  useEffect(() => {
    if (!selectedYear || !yearTo || currentCategories.length === 0 || selectedCategoryIds === undefined) return;
    const params: Record<string, string> = {
      year: String(selectedYear),
      mode,
      scope,
      from: String(yearFrom),
      to: String(yearTo),
    };
    if (scope === 'state_budget' && selectedAreaId) params.area = String(selectedAreaId);
    if (selectedCategoryIds.length > 0 && selectedCategoryIds.length < currentCategories.length) {
      params.areas = selectedCategoryIds.join(',');
    }
    if (compareActive && compareYear) params.compare = String(compareYear);
    setSearchParams(params, { replace: true });
  }, [
    selectedYear,
    mode,
    scope,
    selectedAreaId,
    yearFrom,
    yearTo,
    selectedCategoryIds,
    currentCategories,
    setSearchParams,
    compareActive,
    compareYear,
  ]);

  useEffect(() => {
    if (regularYears.length === 0) return;
    const earliest = regularYears[0];
    const latest = regularYears[regularYears.length - 1];
    if (!regularYears.includes(selectedYear)) setSelectedYear(latest);
    if (!regularYears.includes(yearFrom)) setYearFrom(earliest);
    if (!regularYears.includes(yearTo)) setYearTo(latest);
  }, [regularYears, selectedYear, yearFrom, yearTo]);

  useEffect(() => {
    if (currentCategories.length === 0) return;
    const allIds = currentCategories.map((category) => category.area_id);
    if (selectedCategoryIds === undefined) {
      setSelectedCategoryIds(allIds);
      return;
    }
    const validIds = new Set(allIds);
    const next = selectedCategoryIds.filter((id) => validIds.has(id));
    if (next.length !== selectedCategoryIds.length) {
      setSelectedCategoryIds(next.length > 0 ? next : allIds);
    }
  }, [currentCategories, selectedCategoryIds]);

  const findClosestCompareYear = useCallback((year: number) => {
    const previousYears = regularYears.filter((candidate) => candidate < year);
    if (previousYears.length > 0) return previousYears[previousYears.length - 1];
    return regularYears.find((candidate) => candidate > year) ?? null;
  }, [regularYears]);

  useEffect(() => {
    if (!selectedYear || regularYears.length === 0) return;
    if (compareYear == null || compareYear === selectedYear || !regularYears.includes(compareYear)) {
      setCompareYear(findClosestCompareYear(selectedYear));
    }
  }, [selectedYear, regularYears, compareYear, findClosestCompareYear]);

  const handleScopeChange = useCallback((nextScope: BudgetScope) => {
    if (nextScope === scope) return;
    setScope(nextScope);
    setSelectedAreaId(undefined);
    setSelectedCategoryIds(undefined);
    setCompareYear(null);
  }, [scope]);

  const yearData = useMemo(() => yearById.get(selectedYear), [yearById, selectedYear]);
  const effectiveCompareYear = compareActive && compareYear
    ? compareYear
    : (selectedYear ? (findClosestCompareYear(selectedYear) ?? 0) : 0);
  const compareYearData = useMemo(() => yearById.get(effectiveCompareYear), [yearById, effectiveCompareYear]);

  const { data: budgetData, isLoading: budgetLoading } = useQuery({
    queryKey: ['budget', scope, selectedYear],
    queryFn: () => getBudgetByYear(selectedYear),
    enabled: scope === 'state_budget' && !!selectedYear,
  });

  const { data: publicBudgetData, isLoading: publicBudgetLoading } = useQuery({
    queryKey: ['public-budget', scope, selectedYear],
    queryFn: () => getPublicBudgetByYear(selectedYear),
    enabled: scope === 'public_sector' && !!selectedYear,
  });

  const { data: compareBudgetData } = useQuery({
    queryKey: ['budget', scope, effectiveCompareYear],
    queryFn: () => getBudgetByYear(effectiveCompareYear),
    enabled: scope === 'state_budget' && effectiveCompareYear > 0,
  });

  const { data: comparePublicBudgetData } = useQuery({
    queryKey: ['public-budget', scope, effectiveCompareYear],
    queryFn: () => getPublicBudgetByYear(effectiveCompareYear),
    enabled: scope === 'public_sector' && effectiveCompareYear > 0,
  });

  const stateBudgetRows = useMemo(
    () => budgetData?.filter((fact) => fact.budget_type !== 'shadow_delta') || [],
    [budgetData],
  );

  const totalForYear = useMemo(() => {
    if (scope === 'state_budget') {
      return stateBudgetRows.reduce((sum, fact) => sum + fact.amount_nominal_sek, 0);
    }
    return (publicBudgetData ?? []).reduce((sum, fact) => sum + fact.amount_mkr, 0);
  }, [scope, stateBudgetRows, publicBudgetData]);

  const compareByCategory = useMemo(() => {
    const map = new Map<number, number>();
    if (scope === 'state_budget') {
      for (const fact of compareBudgetData ?? []) {
        if (fact.budget_type !== 'shadow_delta' && fact.anslag_id == null) {
          map.set(fact.area_id, fact.amount_nominal_sek);
        }
      }
      return map;
    }
    for (const fact of comparePublicBudgetData ?? []) {
      map.set(fact.public_function_id, fact.amount_mkr);
    }
    return map;
  }, [scope, compareBudgetData, comparePublicBudgetData]);

  const compareTotalForYear = useMemo(() => {
    if (scope === 'state_budget') {
      return (compareBudgetData ?? [])
        .filter((fact) => fact.budget_type !== 'shadow_delta')
        .reduce((sum, fact) => sum + fact.amount_nominal_sek, 0);
    }
    return (comparePublicBudgetData ?? []).reduce((sum, fact) => sum + fact.amount_mkr, 0);
  }, [scope, compareBudgetData, comparePublicBudgetData]);

  const categoryById = useMemo(
    () => new Map(currentCategories.map((category) => [category.area_id, category])),
    [currentCategories],
  );

  const pieRows = useMemo(() => {
    if (!yearData || currentCategories.length === 0) return [];
    if (scope === 'state_budget') {
      return stateBudgetRows
        .filter((fact) => categoryById.has(fact.area_id))
        .map((fact) => {
          const area = categoryById.get(fact.area_id)!;
          const compareRaw = compareByCategory.get(fact.area_id) ?? null;
          const changePct = compareRaw && compareRaw > 0
            ? ((fact.amount_nominal_sek - compareRaw) / compareRaw) * 100
            : null;
          const compareValue = compareActive && compareRaw != null && compareYearData
            ? convertAmount(compareRaw, mode, compareYearData, compareTotalForYear)
            : undefined;
          return {
            area,
            value: convertAmount(fact.amount_nominal_sek, mode, yearData, totalForYear),
            rawAmount: fact.amount_nominal_sek,
            pct: totalForYear ? (fact.amount_nominal_sek / totalForYear) * 100 : 0,
            changePct,
            compareRawAmount: compareRaw,
            compareValue,
          };
        })
        .sort((a, b) => b.value - a.value);
    }

    return (publicBudgetData ?? [])
      .filter((fact) => categoryById.has(fact.public_function_id))
      .map((fact) => {
        const area = categoryById.get(fact.public_function_id)!;
        const compareRaw = compareByCategory.get(fact.public_function_id) ?? null;
        const changePct = compareRaw && compareRaw > 0
          ? ((fact.amount_mkr - compareRaw) / compareRaw) * 100
          : null;
        const compareValue = compareActive && compareRaw != null && compareYearData
          ? convertAmount(compareRaw, mode, compareYearData, compareTotalForYear)
          : undefined;
        return {
          area,
          value: convertAmount(fact.amount_mkr, mode, yearData, totalForYear),
          rawAmount: fact.amount_mkr,
          pct: totalForYear ? (fact.amount_mkr / totalForYear) * 100 : 0,
          changePct,
          compareRawAmount: compareRaw,
          compareValue,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [
    yearData,
    currentCategories,
    scope,
    stateBudgetRows,
    publicBudgetData,
    categoryById,
    compareByCategory,
    compareActive,
    compareYearData,
    compareTotalForYear,
    mode,
    totalForYear,
  ]);

  const { data: stateTimeSeriesData, isLoading: stateTimeSeriesLoading } = useQuery({
    queryKey: ['timeseries', scope, selectedAreaId, yearFrom, yearTo],
    queryFn: () => selectedAreaId
      ? getAreaTimeSeries(selectedAreaId, yearFrom, yearTo)
      : getAllTimeSeries(yearFrom, yearTo),
    enabled: scope === 'state_budget' && yearFrom > 0 && yearTo > 0,
  });

  const { data: publicTimeSeriesData, isLoading: publicTimeSeriesLoading } = useQuery({
    queryKey: ['public-timeseries', scope, yearFrom, yearTo],
    queryFn: () => getPublicBudgetTimeSeries(yearFrom, yearTo),
    enabled: scope === 'public_sector' && yearFrom > 0 && yearTo > 0,
  });

  const publicTotalsByYear = useMemo(() => {
    const totals = new Map<number, number>();
    for (const fact of publicTimeSeriesData ?? []) {
      totals.set(fact.year_id, (totals.get(fact.year_id) ?? 0) + fact.amount_mkr);
    }
    return totals;
  }, [publicTimeSeriesData]);

  const timeChartSeries = useMemo(() => {
    if (!years || currentCategories.length === 0) return [];
    const filterSet = selectedCategoryIds ? new Set(selectedCategoryIds) : null;
    const grouped: Record<number, { data: { year: number; value: number }[]; sortValue: number }> = {};

    if (scope === 'state_budget') {
      for (const fact of stateTimeSeriesData ?? []) {
        if (fact.budget_type === 'shadow_delta') continue;
        if (filterSet && !filterSet.has(fact.area_id)) continue;
        if (!grouped[fact.area_id]) grouped[fact.area_id] = { data: [], sortValue: 0 };
        const yearMeta = yearById.get(fact.year_id);
        if (!yearMeta) continue;
        const total = (stateTimeSeriesData ?? [])
          .filter((row) => row.year_id === fact.year_id && row.budget_type !== 'shadow_delta')
          .reduce((sum, row) => sum + row.amount_nominal_sek, 0);
        grouped[fact.area_id].data.push({
          year: fact.year_id,
          value: convertAmount(fact.amount_nominal_sek, mode, yearMeta, total),
        });
        if (fact.year_id === yearTo) {
          grouped[fact.area_id].sortValue = total ? (fact.amount_nominal_sek / total) * 100 : 0;
        }
      }
    } else {
      for (const fact of publicTimeSeriesData ?? []) {
        if (filterSet && !filterSet.has(fact.public_function_id)) continue;
        if (!grouped[fact.public_function_id]) grouped[fact.public_function_id] = { data: [], sortValue: 0 };
        const yearMeta = yearById.get(fact.year_id);
        if (!yearMeta) continue;
        const total = publicTotalsByYear.get(fact.year_id) ?? 0;
        grouped[fact.public_function_id].data.push({
          year: fact.year_id,
          value: convertAmount(fact.amount_mkr, mode, yearMeta, total),
        });
        if (fact.year_id === yearTo) {
          grouped[fact.public_function_id].sortValue = total ? (fact.amount_mkr / total) * 100 : 0;
        }
      }
    }

    return Object.entries(grouped)
      .map(([categoryId, entry]) => {
        const nameSv = categoryById.get(Number(categoryId))?.name_sv ?? '';
        if (!nameSv) return null;
        return {
          name: localizeAreaName(nameSv, lang),
          colorKey: nameSv,
          data: entry.data,
          sortValue: entry.sortValue,
        };
      })
      .filter(Boolean) as { name: string; colorKey: string; data: { year: number; value: number }[]; sortValue: number }[];
  }, [
    years,
    currentCategories,
    selectedCategoryIds,
    scope,
    stateTimeSeriesData,
    publicTimeSeriesData,
    yearById,
    mode,
    yearTo,
    publicTotalsByYear,
    categoryById,
    lang,
  ]);

  const rankedAreaIds = useMemo(() => pieRows.map((row) => row.area.area_id), [pieRows]);

  const breadcrumb = useMemo(() => {
    if (scope !== 'state_budget' || !selectedAreaId || !areas) return null;
    const area = areas.find((candidate) => candidate.area_id === selectedAreaId);
    return area?.name_sv;
  }, [scope, selectedAreaId, areas]);

  const selectedScopeLabel = scope === 'public_sector'
    ? t('explorer.scopePublic')
    : t('explorer.scopeState');
  const totalBudgetLabel = scope === 'public_sector'
    ? t('explorer.totalPublicBudget')
    : t('explorer.totalStateBudget');
  const scopeNote = scope === 'public_sector'
    ? t('explorer.scopeNotePublic')
    : t('explorer.scopeNoteState');
  const categoryLabel = scope === 'public_sector' ? t('explorer.table.function') : undefined;
  const chartSource = scope === 'public_sector' ? 'Eurostat' : 'ESV';
  const isBudgetLoading = scope === 'state_budget' ? budgetLoading : publicBudgetLoading;
  const isTimeSeriesLoading = scope === 'state_budget' ? stateTimeSeriesLoading : publicTimeSeriesLoading;
  const showRiksdagenLinks = scope === 'state_budget' && (yearData?.riksdagen_proposition_url || yearData?.riksdagen_decision_url);

  return (
    <section id="explorer" aria-label={t('nav.explorer')} className="py-8 sm:py-12">
      <div className="container">
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

        <div className="space-y-12">
          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-3xl space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    {t('explorer.distribution')} {selectedYear || ''}
                  </h2>
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {selectedScopeLabel}
                  </span>
                  {totalForYear > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {totalBudgetLabel}:{' '}
                      <span className="font-display text-base font-semibold text-foreground tabular-nums">
                        {formatMkrLocalized(totalForYear, lang)}
                      </span>
                    </span>
                  )}
                  {showRiksdagenLinks && (
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
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {scopeNote}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="inline-flex items-center rounded-lg border border-border bg-card p-1"
                    role="group"
                    aria-label={t('explorer.scope')}
                  >
                    <button
                      type="button"
                      onClick={() => handleScopeChange('state_budget')}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        scope === 'state_budget'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t('explorer.scopeState')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScopeChange('public_sector')}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        scope === 'public_sector'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {t('explorer.scopePublic')}
                    </button>
                  </div>
                  <YearPicker
                    years={regularYears}
                    selectedYear={selectedYear}
                    onChange={setSelectedYear}
                  />

                <button
                  onClick={() => setCompareActive((prev) => !prev)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    compareActive
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30',
                  )}
                >
                  {t('explorer.compare')}
                </button>

                {compareActive && (
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="compare-year-select" className="text-sm text-muted-foreground">
                      {t('explorer.compareWith')}
                    </label>
                    <select
                      id="compare-year-select"
                      value={compareYear ?? ''}
                      onChange={(e) => setCompareYear(Number(e.target.value))}
                      className="rounded-lg border border-border bg-card pl-3 pr-8 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
                    >
                      {regularYears
                        .filter((year) => year !== selectedYear)
                        .map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {isBudgetLoading ? (
              <TreemapSkeleton />
            ) : pieRows.length > 0 ? (
              <BudgetPieTable
                rows={pieRows}
                mode={mode}
                year={selectedYear}
                yearData={yearData}
                compareActive={compareActive}
                compareYear={compareYear}
                allowBreakdown
                categoryLabel={categoryLabel}
                sourceLabel={chartSource}
                renderDetail={scope === 'public_sector'
                  ? (row) => (
                      <PublicSubsectorBreakdown
                        year={selectedYear}
                        functionArea={row.area}
                      />
                    )
                  : undefined}
              />
            ) : (
              <p className="py-12 text-center text-muted-foreground">{t('explorer.noData')}</p>
            )}
          </div>

          <div className="space-y-10 rounded-xl bg-muted/30 p-3 sm:p-6 ring-1 ring-border/60">
            <h2 className="font-display text-xl font-semibold text-foreground">
              {t('explorer.politicsHeading')}
            </h2>
            <BudgetBalanceChart />
            <PartyBudgetComparison />
          </div>

          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-xl font-semibold text-foreground">
                {t('explorer.overTime')} {yearFrom || ''}–{yearTo || ''}
              </h2>
              {currentCategories.length > 0 && selectedCategoryIds !== undefined && (
                <CategoryFilter
                  areas={currentCategories}
                  selected={selectedCategoryIds}
                  onChange={setSelectedCategoryIds}
                  rankedAreaIds={rankedAreaIds}
                />
              )}
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-card/60 p-3 ring-1 ring-border/60">
              <ModeSelector mode={mode} onChange={setMode} />
              {regularYears.length > 1 && (
                <YearRangeSlider
                  min={regularYears[0]}
                  max={regularYears[regularYears.length - 1]}
                  from={yearFrom}
                  to={yearTo}
                  onChange={(from, to) => {
                    setYearFrom(from);
                    setYearTo(to);
                  }}
                />
              )}
            </div>

            {isTimeSeriesLoading ? (
              <ChartSkeleton />
            ) : timeChartSeries.length > 0 ? (
              <TimeSeriesChart
                series={timeChartSeries}
                mode={mode}
                yearFrom={yearFrom}
                yearTo={yearTo}
                sourceLabel={chartSource}
              />
            ) : (
              <p className="py-12 text-center text-muted-foreground">{t('explorer.noData')}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Explorer;
