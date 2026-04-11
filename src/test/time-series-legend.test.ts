import { describe, expect, it } from 'vitest';
import { buildTimeSeriesLegendItems } from '@/lib/time-series-legend';

describe('buildTimeSeriesLegendItems', () => {
  it('sorts legend items by the latest visible value descending', () => {
    const legendItems = buildTimeSeriesLegendItems(
      [
        { name: 'Utbildning', data: [{ year: 2024, value: 2.1 }, { year: 2025, value: 2.2 }], sortValue: 9.2 },
        { name: 'Vård', data: [{ year: 2024, value: 5.4 }, { year: 2025, value: 5.6 }], sortValue: 14.6 },
        { name: 'Rättsväsendet', data: [{ year: 2024, value: 1.1 }, { year: 2025, value: 1.2 }], sortValue: 3.1 },
      ],
      2025,
    );

    expect(legendItems.map((item) => item.name)).toEqual([
      'Vård',
      'Utbildning',
      'Rättsväsendet',
    ]);
  });

  it('falls back to the latest available point up to the visible year', () => {
    const legendItems = buildTimeSeriesLegendItems(
      [
        { name: 'Kommuner', data: [{ year: 2023, value: 3.2 }] },
        { name: 'Äldreomsorg', data: [{ year: 2024, value: 1.4 }] },
      ],
      2025,
    );

    expect(legendItems[0]).toMatchObject({ name: 'Kommuner', latestValue: 3.2 });
    expect(legendItems[1]).toMatchObject({ name: 'Äldreomsorg', latestValue: 1.4 });
  });
});
