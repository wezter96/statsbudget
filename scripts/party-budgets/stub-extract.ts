/**
 * Deterministic stub extractor.
 *
 * Given (year, partyCode), returns a plausible-looking set of deltas
 * per utgiftsområde (UO01..UO27). Same inputs always return the same
 * numbers, so developers get stable dev data.
 *
 * The deltas are shaped by a cheap "political archetype" heuristic:
 *   - left-ish parties (S, V, MP) push +welfare / -defence
 *   - right-ish parties (M, SD, KD, L) push -welfare / +defence, +justice
 *   - C sits in the middle, biased towards rural/enterprise
 *   - ALLIANSEN is a mild blend of M+KD+L
 *
 * Magnitudes are in Mkr and roughly bounded at +/- 25% of a typical UO.
 */

import type { ExtractedDelta } from './types';

// Seeded PRNG (mulberry32) — stable & fast
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(parts: (string | number)[]): number {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

// Rough baseline order-of-magnitude per UO in Mkr.
// (Not the real budget — just something to scale the deltas against.)
const UO_BASELINES: Record<string, number> = {
  UO01: 14000, UO02: 17000, UO03: 12000, UO04: 55000, UO05: 3000,
  UO06: 90000, UO07: 55000, UO08: 15000, UO09: 110000, UO10: 120000,
  UO11: 110000, UO12: 100000, UO13: 140000, UO14: 85000, UO15: 27000,
  UO16: 95000, UO17: 17000, UO18: 1500, UO19: 5000, UO20: 24000,
  UO21: 5000, UO22: 75000, UO23: 21000, UO24: 9000, UO25: 110000,
  UO26: 32000, UO27: 160000,
};

type Lean = Record<string, number>; // UO code -> bias multiplier

const LEFT: Lean = {
  UO06: -0.15, // defence
  UO04: -0.05, // justice
  UO09: +0.12, // health
  UO10: +0.10, // economic security
  UO11: +0.08, // pension financial security
  UO12: +0.08, // children/family
  UO13: +0.06, // integration/labour market
  UO14: +0.05, // labour market
  UO15: +0.07, // education
  UO16: +0.10, // education/research
  UO20: +0.12, // environment/climate
  UO25: +0.07, // transfers to local gov
};

const RIGHT: Lean = {
  UO06: +0.18, // defence
  UO04: +0.12, // justice
  UO08: +0.06, // migration (tougher but sometimes more admin)
  UO09: -0.05,
  UO13: -0.12,
  UO10: -0.06,
  UO14: -0.08,
  UO20: -0.10,
  UO24: +0.05, // näringsliv
  UO16: -0.03,
  UO22: +0.04, // transport
};

const CENTER_RURAL: Lean = {
  UO19: +0.10, // regional
  UO23: +0.08, // jord- skogsbruk
  UO24: +0.08, // näringsliv
  UO22: +0.05,
  UO20: +0.04,
  UO13: -0.04,
};

const PARTY_LEAN: Record<string, Lean> = {
  S: LEFT,
  V: scale(LEFT, 1.4),
  MP: merge(LEFT, { UO20: +0.25, UO06: -0.05 }),
  C: merge(CENTER_RURAL, scale(RIGHT, 0.3)),
  L: merge(scale(RIGHT, 0.6), { UO16: +0.04 }),
  KD: merge(scale(RIGHT, 0.8), { UO09: +0.04, UO12: +0.06 }),
  M: RIGHT,
  SD: merge(RIGHT, { UO08: -0.15, UO04: +0.15, UO06: +0.10 }),
  ALLIANSEN: scale(RIGHT, 0.7),
};

function merge(a: Lean, b: Lean): Lean {
  const out: Lean = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

function scale(a: Lean, f: number): Lean {
  const out: Lean = {};
  for (const [k, v] of Object.entries(a)) out[k] = v * f;
  return out;
}

export function stubExtract(year: number, partyCode: string): ExtractedDelta[] {
  const rng = mulberry32(hashSeed([year, partyCode]));
  const lean = PARTY_LEAN[partyCode] ?? {};
  const out: ExtractedDelta[] = [];

  for (const [code, baseline] of Object.entries(UO_BASELINES)) {
    const bias = lean[code] ?? 0;
    // small random jitter ±4% of baseline, plus the political bias
    const jitter = (rng() - 0.5) * 0.08;
    const pct = bias + jitter;
    // Round to nearest 50 Mkr so numbers look plausible
    const delta = Math.round((baseline * pct) / 50) * 50;
    if (delta === 0) continue;
    out.push({
      area_code: code,
      delta_mkr: delta,
      confidence: 0.4 + rng() * 0.3, // stub confidence: 0.4..0.7
      source_quote: `[STUB] Deterministic fabricated delta for ${partyCode} ${year} ${code}`,
    });
  }

  return out;
}
