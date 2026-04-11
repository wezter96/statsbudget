/**
 * Shared OG image renderer.
 * Produces an SVG string from explorer query params.
 * Used by both the Vite dev middleware and the Supabase Edge Function.
 */

export type OgParams = {
  year?: string;
  mode?: string;
  area?: string;
  from?: string;
  to?: string;
  compare?: string;
};

const PALETTE = {
  bg: '#FBF9F4',
  surface: '#FFFFFF',
  text: '#1F1B16',
  muted: '#6B635A',
  accent: '#A14D3A',
  border: '#E8E2D6',
};

const MODE_LABELS: Record<string, string> = {
  total_pct: '% av total',
  real: 'Reala kronor',
  nominal: 'Nominella kronor',
  gdp_pct: '% av BNP',
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function renderOgSvg(params: OgParams): string {
  const year = params.year ?? '';
  const mode = params.mode ?? 'total_pct';
  const from = params.from;
  const to = params.to;
  const modeLabel = MODE_LABELS[mode] ?? mode;

  const headline = year
    ? `Statsbudgeten ${year}`
    : 'Så används dina skattepengar';

  const sub = from && to
    ? `${from}–${to} · ${modeLabel}`
    : modeLabel;

  const W = 1200;
  const H = 630;

  // Simple decorative bars row — placeholder visual
  const bars = Array.from({ length: 12 }).map((_, i) => {
    const x = 120 + i * 80;
    const h = 60 + Math.round(Math.sin(i * 1.3) * 40 + Math.random() * 60);
    return `<rect x="${x}" y="${H - 120 - h}" width="48" height="${h}" rx="6" fill="${PALETTE.accent}" opacity="${0.35 + (i % 4) * 0.15}"/>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${PALETTE.bg}"/>
  <rect x="0" y="0" width="${W}" height="8" fill="${PALETTE.accent}"/>
  <text x="120" y="180" font-family="'Fraunces', Georgia, serif" font-size="84" font-weight="600" fill="${PALETTE.text}">${escapeXml(headline)}</text>
  <text x="120" y="240" font-family="'Inter', system-ui, sans-serif" font-size="32" fill="${PALETTE.muted}">${escapeXml(sub)}</text>
  ${bars}
  <line x1="120" y1="${H - 60}" x2="${W - 120}" y2="${H - 60}" stroke="${PALETTE.border}" stroke-width="1"/>
  <text x="120" y="${H - 28}" font-family="'Inter', system-ui, sans-serif" font-size="22" fill="${PALETTE.muted}">Statsbudget · Källor: ESV · SCB · Riksdagen</text>
</svg>`;
}
