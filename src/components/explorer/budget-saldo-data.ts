// Statens budgetsaldo (mdkr) — source: Ekonomifakta / ESV.
// Government bloc mapping by budget execution year.

export type GovBloc = 'S' | 'borgerlig';

export interface SaldoRow {
  year: number;
  saldo_mdkr: number;
  bloc: GovBloc;
}

// Government transitions (PM took office → budget execution starts next year):
//   Oct 1976 Fälldin → borgerlig from 1977
//   Oct 1982 Palme   → S from 1983
//   Oct 1991 Bildt   → borgerlig from 1992
//   Oct 1994 Carlsson→ S from 1995
//   Oct 2006 Reinfeldt→ borgerlig from 2007
//   Oct 2014 Löfven  → S from 2015
//   Oct 2022 Kristersson → borgerlig from 2023
function govBloc(year: number): GovBloc {
  if (year <= 1976) return 'S';
  if (year <= 1982) return 'borgerlig';
  if (year <= 1991) return 'S';
  if (year <= 1994) return 'borgerlig';
  if (year <= 2006) return 'S';
  if (year <= 2014) return 'borgerlig';
  if (year <= 2022) return 'S';
  return 'borgerlig';
}

const RAW: [number, number][] = [
  [1970, -3.3], [1971, -3.2], [1972, -6.6], [1973, -6.2], [1974, -10.4],
  [1975, -11.6], [1976, -6.2], [1977, -18.2], [1978, -32.6], [1979, -45.5],
  [1980, -52.9], [1981, -66.3], [1982, -83.1], [1983, -80.0], [1984, -75.4],
  [1985, -57.0], [1986, -39.0], [1987, -11.0], [1988, 8.0], [1989, 26.0],
  [1990, -14.0], [1991, -81.0], [1992, -144.0], [1993, -211.0], [1994, -122.0],
  [1995, -154.0], [1996, -58.0], [1997, -6.0], [1998, 10.0], [1999, 80.0],
  [2000, 102.0], [2001, 37.0], [2002, 1.0], [2003, -46.0], [2004, -53.0],
  [2005, 16.0], [2006, 20.0], [2007, 102.0], [2008, 133.0], [2009, -176.0],
  [2010, -1.0], [2011, 69.0], [2012, -23.0], [2013, -129.0], [2014, -72.0],
  [2015, -33.0], [2016, 87.0], [2017, 62.0], [2018, 82.0], [2019, 110.8],
  [2020, -220.6], [2021, 77.8], [2022, 163.7], [2023, 19.7], [2024, -104.1],
  [2025, -101.9],
];

export const SALDO_DATA: SaldoRow[] = RAW.map(([year, saldo]) => ({
  year,
  saldo_mdkr: saldo,
  bloc: govBloc(year),
}));
