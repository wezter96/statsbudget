// Statens budgetsaldo (mdkr) — source: Ekonomifakta / ESV.
// Statsskuld (mdkr, year-end) — source: Riksgälden / Ekonomifakta.
// Government bloc mapping by budget execution year.

export type GovBloc = 'S' | 'borgerlig';

export interface SaldoRow {
  year: number;
  saldo_mdkr: number;
  skuld_mdkr: number;
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

// [year, saldo_mdkr, skuld_mdkr]
const RAW: [number, number, number][] = [
  [1970, -3.3, 33],    [1971, -3.2, 36],    [1972, -6.6, 39],
  [1973, -6.2, 43],    [1974, -10.4, 50],   [1975, -11.6, 68],
  [1976, -6.2, 79],    [1977, -18.2, 99],   [1978, -32.6, 126],
  [1979, -45.5, 155],  [1980, -52.9, 208],  [1981, -66.3, 265],
  [1982, -83.1, 330],  [1983, -80.0, 390],  [1984, -75.4, 450],
  [1985, -57.0, 560],  [1986, -39.0, 590],  [1987, -11.0, 600],
  [1988, 8.0, 575],    [1989, 26.0, 555],   [1990, -14.0, 595],
  [1991, -81.0, 690],  [1992, -144.0, 830], [1993, -211.0, 1060],
  [1994, -122.0, 1230],[1995, -154.0, 1369],[1996, -58.0, 1411],
  [1997, -6.0, 1432],  [1998, 10.0, 1449],  [1999, 80.0, 1374],
  [2000, 102.0, 1281], [2001, 37.0, 1250],  [2002, 1.0, 1260],
  [2003, -46.0, 1275], [2004, -53.0, 1302], [2005, 16.0, 1303],
  [2006, 20.0, 1270],  [2007, 102.0, 1168], [2008, 133.0, 1140],
  [2009, -176.0, 1200],[2010, -1.0, 1115],  [2011, 69.0, 1061],
  [2012, -23.0, 1150], [2013, -129.0, 1220],[2014, -72.0, 1317],
  [2015, -33.0, 1381], [2016, 87.0, 1298],  [2017, 62.0, 1245],
  [2018, 82.0, 1177],  [2019, 110.8, 1113], [2020, -220.6, 1226],
  [2021, 77.8, 1148],  [2022, 163.7, 1031], [2023, 19.7, 978],
  [2024, -104.1, 1095],[2025, -101.9, 1244],
];

export const SALDO_DATA: SaldoRow[] = RAW.map(([year, saldo, skuld]) => ({
  year,
  saldo_mdkr: saldo,
  skuld_mdkr: skuld,
  bloc: govBloc(year),
}));
