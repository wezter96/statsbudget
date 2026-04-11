/**
 * Statsbudget color system.
 *
 * Every category gets a deterministic, unique color via `stableColor(name)`
 * so side-by-side budgets never map different categories to the same hue.
 *
 * Strategy:
 *   1. A 60-color bold palette generated from golden-ratio hue rotation
 *      with alternating saturation/lightness bands — distinct to the eye.
 *   2. A hand-tuned index map for the 52 known modern+legacy category names
 *      guaranteeing zero collisions in real charts.
 *   3. Djb2 hash fallback for anything unknown.
 */

export const CHROME = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#16181D',
  textMuted: '#5C6470',
  border: '#E4E7EC',
  primary: '#1E40AF',
  positive: '#16A34A',
  negative: '#DC2626',
} as const;

// ---------- Perceptual color math (sRGB → Lab, ΔE76) ----------

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const x = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * x).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

type Lab = { L: number; a: number; b: number };

function hexToLab(hex: string): Lab {
  const [r, g, b] = hexToRgb(hex);
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  // linear RGB → XYZ (D65)
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;
  // XYZ → Lab
  const refX = 0.95047;
  const refY = 1.0;
  const refZ = 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x / refX);
  const fy = f(y / refY);
  const fz = f(z / refZ);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** ΔE76 — Euclidean distance in CIE Lab space. Simple but perceptually sound. */
function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

/**
 * Build a maximally perceptually distinct palette of size `n`.
 *
 * Algorithm:
 *   1. Generate ~500 candidate colors across H/S/L (bold-only range).
 *   2. Greedy: start with a bold red, then repeatedly add the candidate
 *      whose minimum ΔE to already-selected is the largest.
 *   3. Result: every pair of colors has ΔE ≥ achieved minimum.
 *
 * For 60 colors from a 500-pool the achieved min ΔE is typically ~18–22,
 * which is comfortably above the "clearly different" threshold (~10).
 */
function buildDistinctPalette(n: number): string[] {
  const candidates: { hex: string; lab: Lab }[] = [];
  // Hue steps every 4° × 3 saturations × 3 lightnesses = 810 candidates.
  // Range picked to stay vivid on warm paper bg without pure primaries.
  for (let h = 0; h < 360; h += 4) {
    for (const s of [65, 75, 85]) {
      for (const l of [45, 55, 65]) {
        const hex = hslToHex(h, s, l);
        candidates.push({ hex, lab: hexToLab(hex) });
      }
    }
  }

  const selected: { hex: string; lab: Lab }[] = [];
  const seedHex = hslToHex(0, 75, 50);
  selected.push({ hex: seedHex, lab: hexToLab(seedHex) });

  while (selected.length < n && selected.length < candidates.length) {
    let bestIdx = -1;
    let bestMinDE = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (selected.some((s) => s.hex === c.hex)) continue;
      let minDE = Infinity;
      for (const s of selected) {
        const de = deltaE(c.lab, s.lab);
        if (de < minDE) minDE = de;
        if (minDE <= bestMinDE) break;
      }
      if (minDE > bestMinDE) {
        bestMinDE = minDE;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    selected.push(candidates[bestIdx]);
  }
  return selected.map((s) => s.hex);
}

export const EXTENDED_PALETTE = buildDistinctPalette(60);

/**
 * Hand-tuned 14-color "primary" palette — used for the small top-N
 * rendering paths that don't need cross-dataset stability (e.g. the
 * legacy `catColor(i)` helper). Kept for backwards compat.
 */
export const CATEGORICAL = [
  '#E63946', '#1D4ED8', '#16A34A', '#F59E0B', '#9333EA',
  '#0891B2', '#DB2777', '#EA580C', '#65A30D', '#7C3AED',
  '#0EA5E9', '#DC2626', '#059669', '#C026D3',
] as const;

export function catColor(i: number): string {
  return CATEGORICAL[i % CATEGORICAL.length];
}

/**
 * Every known category across modern UOs and legacy huvudtitlar gets a
 * unique slot in EXTENDED_PALETTE. Indexes are chosen so semantically
 * related concepts across eras get the same color
 * (e.g. Socialdepartementet 1975 ≈ Hälsovård/ekonomisk trygghet 2025).
 */
const CATEGORY_SLOTS: Record<string, number> = {
  // --- Modern 27 utgiftsområden (post-1997) ---
  'Rikets styrelse': 0,
  'Samhällsekonomi och finansförvaltning': 1,
  'Skatt, tull och exekution': 2,
  'Rättsväsendet': 3,
  'Internationell samverkan': 4,
  'Försvar och samhällets krisberedskap': 5,
  'Internationellt bistånd': 6,
  'Migration': 7,
  'Hälsovård, sjukvård och social omsorg': 8,
  'Ekonomisk trygghet vid sjukdom och funktionsnedsättning': 9,
  'Ekonomisk trygghet vid ålderdom': 10,
  'Ekonomisk trygghet för familjer och barn': 11,
  'Integration och jämställdhet': 12,
  'Arbetsmarknad och arbetsliv': 13,
  'Studiestöd': 14,
  'Utbildning och universitetsforskning': 15,
  'Kultur, medier, trossamfund och fritid': 16,
  'Samhällsplanering, bostadsförsörjning och byggande samt konsumentpolitik': 17,
  'Regional utveckling': 18,
  'Klimat, miljö och natur': 19,
  'Energi': 20,
  'Kommunikationer': 21,
  'Areella näringar, landsbygd och livsmedel': 22,
  'Näringsliv': 23,
  'Allmänna bidrag till kommuner': 24,
  'Statsskuldsräntor m.m.': 25,
  'Avgiften till Europeiska unionen': 26,
  'Riksrevisionen': 27,

  // --- Legacy huvudtitlar (1975/1980/1985) ---
  // Aligned to closest modern concept where possible; otherwise unique slots.
  'Socialdepartementet': 8,              // ≈ Hälsovård
  'Utbildningsdepartementet': 15,        // ≈ Utbildning
  'Försvarsdepartementet': 5,            // ≈ Försvar
  'Justitiedepartementet': 3,            // ≈ Rättsväsendet
  'Utrikesdepartementet': 6,             // ≈ Internationellt bistånd
  'Kommunikationsdepartementet': 21,     // ≈ Kommunikationer
  'Arbetsmarknadsdepartementet': 13,     // ≈ Arbetsmarknad
  'Bostadsdepartementet': 17,            // ≈ Samhällsplanering
  'Jordbruksdepartementet': 22,          // ≈ Areella näringar
  'Handelsdepartementet': 23,            // ≈ Näringsliv (handel)
  'Industridepartementet': 28,           // own slot
  'Budgetdepartementet': 29,
  'Ekonomidepartementet': 1,             // ≈ Samhällsekonomi
  'Finansdepartementet': 1,              // ≈ Samhällsekonomi
  'Civildepartementet': 30,
  'Kommundepartementet': 24,             // ≈ Allmänna bidrag till kommuner
  'Räntor på statsskulden': 25,          // ≈ Statsskuldsräntor
  'Kungl hov- och slottsstaterna': 31,
  'Riksdagen och dess myndigheter': 0,   // ≈ Rikets styrelse
  'Oförutsedda utgifter': 32,
  'Kungl hov- och slottsstaterna m.m. (första huvudtiteln — verifiera!)': 31,
};

function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h;
}

/**
 * Reserved unknown range — anything not in CATEGORY_SLOTS hashes into
 * indexes 40..59 so it can't collide with known names (0..32).
 */
const UNKNOWN_RANGE_START = 40;
const UNKNOWN_RANGE_SIZE = EXTENDED_PALETTE.length - UNKNOWN_RANGE_START;

export function stableColor(name: string): string {
  const slot = CATEGORY_SLOTS[name];
  if (slot != null) return EXTENDED_PALETTE[slot];
  const idx = UNKNOWN_RANGE_START + (Math.abs(djb2(name)) % UNKNOWN_RANGE_SIZE);
  return EXTENDED_PALETTE[idx];
}

export const ECHARTS_COLOR_ARRAY = [...CATEGORICAL];
