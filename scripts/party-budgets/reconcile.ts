/**
 * Reconciles a set of extracted deltas:
 *   - drops deltas for unknown UO codes
 *   - drops deltas that are absurdly large (>100 Gkr = 100_000 Mkr per UO)
 *   - sums deltas, and if the motion declared a total, rejects the whole
 *     extraction when the sum deviates by more than ±5% of the declared total
 *   - deduplicates by area_code (keeps highest-confidence row)
 */

import type { ExtractedDelta, ReconcileResult } from './types';

const VALID_AREA_CODES = new Set(
  Array.from({ length: 27 }, (_, i) => `UO${String(i + 1).padStart(2, '0')}`),
);

const MAX_PER_AREA_MKR = 100_000; // 100 Gkr sanity cap

export function reconcile(
  deltas: ExtractedDelta[],
  declaredTotal?: number,
): ReconcileResult {
  const dropped: { delta: ExtractedDelta; reason: string }[] = [];

  // 1. Filter invalid area codes & absurd magnitudes.
  const clean: ExtractedDelta[] = [];
  for (const d of deltas) {
    if (!VALID_AREA_CODES.has(d.area_code)) {
      dropped.push({ delta: d, reason: `unknown area_code ${d.area_code}` });
      continue;
    }
    if (!Number.isFinite(d.delta_mkr)) {
      dropped.push({ delta: d, reason: 'non-finite delta_mkr' });
      continue;
    }
    if (Math.abs(d.delta_mkr) > MAX_PER_AREA_MKR) {
      dropped.push({ delta: d, reason: `outlier ${d.delta_mkr} Mkr` });
      continue;
    }
    clean.push(d);
  }

  // 2. Dedupe — keep highest confidence per area_code.
  const byArea = new Map<string, ExtractedDelta>();
  for (const d of clean) {
    const existing = byArea.get(d.area_code);
    if (!existing || d.confidence > existing.confidence) byArea.set(d.area_code, d);
    else dropped.push({ delta: d, reason: 'duplicate, lower confidence' });
  }
  const kept = Array.from(byArea.values());

  const total = kept.reduce((s, d) => s + d.delta_mkr, 0);

  // 3. If declared total present, verify within ±5%.
  if (declaredTotal !== undefined && Math.abs(declaredTotal) > 0) {
    const tolerance = Math.abs(declaredTotal) * 0.05;
    if (Math.abs(total - declaredTotal) > tolerance) {
      // reject all — something is off
      for (const d of kept) dropped.push({ delta: d, reason: `sum ${total} Mkr outside ±5% of declared ${declaredTotal}` });
      return { kept: [], dropped, total_mkr: 0, declared_total_mkr: declaredTotal };
    }
  }

  return { kept, dropped, total_mkr: total, declared_total_mkr: declaredTotal };
}
