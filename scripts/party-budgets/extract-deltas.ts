/**
 * LLM-backed extractor. Calls Claude via the Anthropic REST API with a
 * tool-use schema that forces strict JSON output.
 *
 * Falls back to stub-extract if:
 *   - ANTHROPIC_API_KEY is not set
 *   - USE_STUB=true is set
 *   - the motion text is null/empty
 *   - the API call throws
 *
 * Model: claude-sonnet-4-6 (configurable via ANTHROPIC_MODEL).
 */

import type { ExtractedDelta, MotionDoc } from './types';
import { stubExtract } from './stub-extract';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

const EXTRACTION_TOOL = {
  name: 'report_budget_deltas',
  description:
    'Report a list of deltas (positive = more than government, negative = less) ' +
    'per Swedish utgiftsområde (UO01..UO27) extracted from a party budget motion.',
  input_schema: {
    type: 'object' as const,
    properties: {
      deltas: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            area_code: { type: 'string', pattern: '^UO\\d{2}$' },
            delta_mkr: {
              type: 'number',
              description: 'Delta vs government budget in millions SEK (Mkr). Integer preferred.',
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            source_quote: {
              type: 'string',
              description: 'Verbatim quote (<= 240 chars) from the motion supporting this number.',
            },
          },
          required: ['area_code', 'delta_mkr', 'confidence', 'source_quote'],
        },
      },
      declared_total_mkr: {
        type: 'number',
        description:
          'If the motion declares a total net delta vs the government budget ' +
          '(e.g. "our budget is 12 billion more than the government\'s"), return it here in Mkr.',
      },
    },
    required: ['deltas'],
  },
};

const SYSTEM_PROMPT = `Du är en expert på svensk statsbudget. Du läser ett parti-motionstext ("skuggbudget") och extraherar hur partiet vill avvika från regeringens budgetförslag, uppdelat per utgiftsområde (UO01..UO27). Returnera ENDAST strikt JSON via verktyget report_budget_deltas.

Regler:
- delta_mkr är i miljoner kronor. Positivt = partiet vill spendera MER än regeringen. Negativt = mindre.
- Hoppa över utgiftsområden som motionen inte uttryckligen nämner (antyd inte 0).
- source_quote måste vara ordagrann (≤240 tecken) från motionen.
- confidence: 0.9 om siffran står explicit i texten, 0.6 om du härleder den från text, 0.3 om du gissar utifrån kontext.
- Om motionen anger ett nettototal vs regeringen, sätt declared_total_mkr.`;

async function callClaude(text: string, apiKey: string): Promise<{
  deltas: ExtractedDelta[];
  declared_total_mkr?: number;
}> {
  const body = {
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'tool', name: 'report_budget_deltas' },
    messages: [
      {
        role: 'user',
        content:
          `Extrahera skuggbudgetens deltan per utgiftsområde från följande motionstext.\n\n` +
          `--- MOTIONSTEXT ---\n${text.slice(0, 180_000)}\n--- SLUT ---`,
      },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  }
  const payload: any = await res.json();
  const toolUse = payload.content?.find((c: any) => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude returned no tool_use block');
  const input = toolUse.input ?? {};
  return {
    deltas: (input.deltas ?? []) as ExtractedDelta[],
    declared_total_mkr: input.declared_total_mkr,
  };
}

export async function extractDeltas(
  motion: MotionDoc,
  year: number,
  opts: { useStub?: boolean } = {},
): Promise<{ deltas: ExtractedDelta[]; declared_total_mkr?: number; mode: 'stub' | 'llm' }> {
  const forceStub = opts.useStub || process.env.USE_STUB === 'true';
  const key = process.env.ANTHROPIC_API_KEY;
  if (forceStub || !key || !motion.text) {
    return { deltas: stubExtract(year, motion.party_code), mode: 'stub' };
  }
  try {
    const res = await callClaude(motion.text, key);
    return { ...res, mode: 'llm' };
  } catch (e) {
    console.warn(`[extract] LLM failed for ${motion.party_code} ${year}: ${(e as Error).message} — falling back to stub`);
    return { deltas: stubExtract(year, motion.party_code), mode: 'stub' };
  }
}
