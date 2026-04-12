// Loader for skatteintakter master list and fact rows.
//
// Sources:
//   scripts/skatteintakter/master-list.json — curated income title definitions
//   data/skatteintakter.csv                 — yearly amounts from ESV

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IncomeTitleDef, IncomeFact } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function getMasterList(): Promise<IncomeTitleDef[]> {
  const jsonPath = resolve(__dirname, 'master-list.json');
  if (!existsSync(jsonPath)) {
    throw new Error(
      'master-list.json missing at ' + jsonPath,
    );
  }
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as IncomeTitleDef[];
}

/**
 * Load fact rows from the CSV. Returns [] if no CSV found.
 */
export async function loadFacts(repoRoot: string): Promise<IncomeFact[]> {
  const csvPath = resolve(repoRoot, 'data', 'skatteintakter.csv');
  if (!existsSync(csvPath)) {
    console.warn(`[skatteintakter] No CSV at ${csvPath}`);
    return [];
  }
  const text = await readFile(csvPath, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
  if (lines.length === 0) return [];

  const header = lines[0].split(',').map(h => h.trim());
  const idx = {
    year: header.indexOf('year'),
    code: header.indexOf('code'),
    amount: header.indexOf('amount_mkr'),
    est: header.indexOf('is_estimated'),
  };
  if (idx.year < 0 || idx.code < 0 || idx.amount < 0) {
    throw new Error(
      `skatteintakter.csv: missing required columns. Got: ${header.join(',')}`,
    );
  }

  const facts: IncomeFact[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(c => c.trim());
    facts.push({
      year: parseInt(cols[idx.year], 10),
      code: cols[idx.code],
      amount_mkr: parseFloat(cols[idx.amount]),
      is_estimated: idx.est >= 0 ? cols[idx.est].toLowerCase() === 'true' : false,
    });
  }
  return facts;
}
