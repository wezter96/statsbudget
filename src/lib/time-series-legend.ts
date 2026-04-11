import { stableColor } from './palette';

export interface TimeSeriesLegendPoint {
  year: number;
  value: number;
}

export interface TimeSeriesLegendSeries {
  name: string;
  data: TimeSeriesLegendPoint[];
  color?: string;
  sortValue?: number;
}

export interface TimeSeriesLegendItem {
  name: string;
  color: string;
  latestValue: number;
}

function getLatestVisibleValue(points: TimeSeriesLegendPoint[], year: number): number {
  let latestValue = 0;
  let latestYear = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.year > year) continue;
    if (point.year > latestYear) {
      latestYear = point.year;
      latestValue = point.value;
    }
  }

  return latestValue;
}

export function buildTimeSeriesLegendItems(
  series: TimeSeriesLegendSeries[],
  currentYear: number,
): TimeSeriesLegendItem[] {
  return [...series]
    .map((entry) => ({
      name: entry.name,
      color: entry.color ?? stableColor(entry.name),
      latestValue: entry.sortValue ?? getLatestVisibleValue(entry.data, currentYear),
    }))
    .sort((a, b) => b.latestValue - a.latestValue || a.name.localeCompare(b.name, 'sv'));
}
