// Provider adapters for the chat edge function.
//
// Supported providers (all free / cheap, no Anthropic required):
//   - nvidia: NVIDIA NIM free endpoints (integrate.api.nvidia.com/v1)
//   - groq:   Groq free tier (api.groq.com/openai/v1)
//   - anthropic: optional passthrough; only used if ANTHROPIC_API_KEY set
//     and the resolved model is a claude-* id.
//
// Both NVIDIA and Groq speak OpenAI-compatible chat.completions streaming,
// so they share a single adapter `streamOpenAICompat` that translates
// Anthropic-canonical messages/tools ↔ OpenAI format.
//
// ---- Key pools + rotation -------------------------------------------------
// NVIDIA / Groq free tiers have tight per-minute rate limits per API key.
// The registry accepts a comma-separated list of keys per provider
// (NVIDIA_API_KEYS / GROQ_API_KEYS) and round-robins across them. If a
// request fails with 429 / 5xx, we advance to the next key and retry up
// to the pool size. This is edge-function local state — Supabase keeps
// the isolate warm between invocations, so the rotation spreads real
// load even without shared storage.

// ----- shared types --------------------------------------------------------

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
}
export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface StreamCallbacks {
  onText: (delta: string) => void;
  onToolUse: (block: AnthropicToolUseBlock) => void;
}

export interface StreamResult {
  content: AnthropicContentBlock[];
  /** Canonical Anthropic stop_reason: 'end_turn' | 'tool_use' | ... */
  stopReason: string;
}

// ----- model registry ------------------------------------------------------

export type ProviderId = 'anthropic' | 'nvidia' | 'groq';

export interface ModelInfo {
  provider: ProviderId;
  /** id sent in the provider's request body */
  providerModelId: string;
  supportsTools: boolean;
}

const REGISTRY: Record<string, ModelInfo> = {
  // --- Groq (free, fast, tool-capable) ---
  'llama-3.3-70b-versatile': {
    provider: 'groq',
    providerModelId: 'llama-3.3-70b-versatile',
    supportsTools: true,
  },
  'llama-3.1-8b-instant': {
    provider: 'groq',
    providerModelId: 'llama-3.1-8b-instant',
    supportsTools: true,
  },
  'groq-kimi-k2': {
    provider: 'groq',
    providerModelId: 'moonshotai/kimi-k2-instruct',
    supportsTools: true,
  },
  'gpt-oss-120b': {
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-120b',
    supportsTools: true,
  },
  'gpt-oss-20b': {
    provider: 'groq',
    providerModelId: 'openai/gpt-oss-20b',
    supportsTools: true,
  },
  'qwen3-32b': {
    provider: 'groq',
    providerModelId: 'qwen/qwen3-32b',
    supportsTools: true,
  },

  // --- NVIDIA NIM (free, tool-capable) ---
  'kimi-k2-instruct': {
    provider: 'nvidia',
    providerModelId: 'moonshotai/kimi-k2-instruct',
    supportsTools: true,
  },
  'kimi-k2-instruct-0905': {
    provider: 'nvidia',
    providerModelId: 'moonshotai/kimi-k2-instruct-0905',
    supportsTools: true,
  },
  'kimi-k2-thinking': {
    provider: 'nvidia',
    providerModelId: 'moonshotai/kimi-k2-thinking',
    supportsTools: true,
  },
  'glm-4.7': {
    provider: 'nvidia',
    providerModelId: 'zai-org/glm-4.7',
    supportsTools: true,
  },
  'deepseek-v3.1-terminus': {
    provider: 'nvidia',
    providerModelId: 'deepseek-ai/deepseek-v3.1-terminus',
    supportsTools: true,
  },
  'qwen3-coder-480b': {
    provider: 'nvidia',
    providerModelId: 'qwen/qwen3-coder-480b-a35b-instruct',
    supportsTools: true,
  },
  'mistral-nemotron': {
    provider: 'nvidia',
    providerModelId: 'mistralai/mistral-nemotron',
    supportsTools: true,
  },

  // --- Anthropic (optional passthrough) ---
  'claude-haiku-4-5-20251001': {
    provider: 'anthropic',
    providerModelId: 'claude-haiku-4-5-20251001',
    supportsTools: true,
  },
  'claude-sonnet-4-6': {
    provider: 'anthropic',
    providerModelId: 'claude-sonnet-4-6',
    supportsTools: true,
  },
};

/** Strict lookup — returns null for unknown ids. */
export function resolveModel(id: string): ModelInfo | null {
  return REGISTRY[id] ?? null;
}

/** List every registered model id (for validation + future UI dropdown). */
export function listModels(): Array<{ id: string; info: ModelInfo }> {
  return Object.entries(REGISTRY).map(([id, info]) => ({ id, info }));
}

// ----- key pools + rotation ------------------------------------------------

const PROVIDER_KEYS: Record<ProviderId, string[]> = {
  anthropic: [],
  nvidia: [],
  groq: [],
};
const PROVIDER_CURSOR: Record<ProviderId, number> = {
  anthropic: 0,
  nvidia: 0,
  groq: 0,
};

function parseKeys(...values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  for (const v of values) {
    if (!v) continue;
    for (const k of v.split(',')) {
      const trimmed = k.trim();
      if (trimmed) seen.add(trimmed);
    }
  }
  return [...seen];
}

/**
 * Populate provider key pools from env. Call once at module init.
 * Each provider accepts both a single-key var and a plural var; all
 * values are merged + deduped.
 */
export function loadKeys(env: {
  anthropic?: string;
  nvidia?: string;
  nvidiaPlural?: string;
  groq?: string;
  groqPlural?: string;
}) {
  PROVIDER_KEYS.anthropic = parseKeys(env.anthropic);
  PROVIDER_KEYS.nvidia = parseKeys(env.nvidia, env.nvidiaPlural);
  PROVIDER_KEYS.groq = parseKeys(env.groq, env.groqPlural);
}

export function hasProviderKeys(p: ProviderId): boolean {
  return PROVIDER_KEYS[p].length > 0;
}

export function providerKeyCount(p: ProviderId): number {
  return PROVIDER_KEYS[p].length;
}

function advanceCursor(p: ProviderId): string {
  const pool = PROVIDER_KEYS[p];
  if (!pool.length) throw new Error(`no ${p} keys configured`);
  const i = PROVIDER_CURSOR[p] % pool.length;
  PROVIDER_CURSOR[p] = (PROVIDER_CURSOR[p] + 1) % pool.length;
  return pool[i];
}

// ----- OpenAI-compatible adapter (NVIDIA + Groq) --------------------------

const PROVIDER_BASE_URL: Record<Exclude<ProviderId, 'anthropic'>, string> = {
  nvidia: 'https://integrate.api.nvidia.com/v1',
  groq: 'https://api.groq.com/openai/v1',
};

interface OpenAICompatOptions {
  model: ModelInfo;
  messages: AnthropicMessage[];
  system: string;
  tools: ToolSchema[];
  maxTokens?: number;
  callbacks: StreamCallbacks;
}

interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

function toOpenAIMessages(
  system: string,
  messages: AnthropicMessage[],
): OpenAIChatMessage[] {
  const out: OpenAIChatMessage[] = [{ role: 'system', content: system }];
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (msg.role === 'assistant') {
      let text = '';
      const toolCalls: NonNullable<OpenAIChatMessage['tool_calls']> = [];
      for (const block of msg.content) {
        if (block.type === 'text') text += block.text;
        else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            type: 'function',
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }
      const m: OpenAIChatMessage = { role: 'assistant' };
      if (text) m.content = text;
      if (toolCalls.length) m.tool_calls = toolCalls;
      out.push(m);
    } else {
      // user turn: tool_results become role:'tool' messages (one per id);
      // free text becomes a trailing user message.
      const textParts: string[] = [];
      for (const block of msg.content) {
        if (block.type === 'tool_result') {
          out.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: block.content,
          });
        } else if (block.type === 'text') {
          textParts.push(block.text);
        }
      }
      if (textParts.length) {
        out.push({ role: 'user', content: textParts.join('\n') });
      }
    }
  }
  return out;
}

function toOpenAITools(tools: ToolSchema[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));
}

async function callOpenAICompatOnce(
  baseUrl: string,
  apiKey: string,
  opts: OpenAICompatOptions,
): Promise<StreamResult> {
  const body: Record<string, unknown> = {
    model: opts.model.providerModelId,
    stream: true,
    max_tokens: opts.maxTokens ?? 1024,
    messages: toOpenAIMessages(opts.system, opts.messages),
  };
  if (opts.model.supportsTools && opts.tools.length) {
    body.tools = toOpenAITools(opts.tools);
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    // Include status in the message so the retry layer can match on 429/5xx.
    throw new Error(`${opts.model.provider} ${res.status}: ${text}`);
  }

  let accumulatedText = '';
  const toolCallsByIndex = new Map<
    number,
    { id: string; name: string; args: string }
  >();
  let stopReason: string = 'end_turn';

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx: number;
    while ((sepIdx = buffer.indexOf('\n')) >= 0) {
      const rawLine = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 1);
      const line = rawLine.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let json: any;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      const choice = json.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta ?? {};
      if (typeof delta.content === 'string' && delta.content) {
        accumulatedText += delta.content;
        opts.callbacks.onText(delta.content);
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx: number = typeof tc.index === 'number' ? tc.index : 0;
          let entry = toolCallsByIndex.get(idx);
          if (!entry) {
            entry = { id: '', name: '', args: '' };
            toolCallsByIndex.set(idx, entry);
          }
          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name += tc.function.name;
          if (typeof tc.function?.arguments === 'string') {
            entry.args += tc.function.arguments;
          }
        }
      }
      if (choice.finish_reason) {
        stopReason =
          choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn';
      }
    }
  }

  const content: AnthropicContentBlock[] = [];
  if (accumulatedText) {
    content.push({ type: 'text', text: accumulatedText });
  }
  let synth = 0;
  for (const entry of toolCallsByIndex.values()) {
    if (!entry.name) continue;
    let input: Record<string, unknown> = {};
    try {
      input = entry.args ? JSON.parse(entry.args) : {};
    } catch {
      input = {};
    }
    const block: AnthropicToolUseBlock = {
      type: 'tool_use',
      id: entry.id || `call_${synth++}`,
      name: entry.name,
      input,
    };
    opts.callbacks.onToolUse(block);
    content.push(block);
  }
  if (stopReason !== 'tool_use' && toolCallsByIndex.size > 0) {
    stopReason = 'tool_use';
  }

  return { content, stopReason };
}

/**
 * Stream from a Groq or NVIDIA NIM endpoint. Rotates through the
 * provider's key pool; on 429 / 5xx from a given key, advances to the
 * next one and retries, up to `poolSize` attempts total.
 *
 * Errors from callbacks (already-emitted text / tool_use events) cannot
 * be cleanly rolled back, so we only retry if the fetch rejects BEFORE
 * we begin streaming — i.e. on non-ok HTTP responses. Once the stream
 * starts, any mid-stream failure surfaces to the handler.
 */
export async function streamOpenAICompat(
  opts: OpenAICompatOptions,
): Promise<StreamResult> {
  const provider = opts.model.provider;
  if (provider === 'anthropic') {
    throw new Error('streamOpenAICompat called with anthropic model');
  }
  const baseUrl = PROVIDER_BASE_URL[provider];
  const poolSize = PROVIDER_KEYS[provider].length;
  if (!poolSize) throw new Error(`no ${provider} keys configured`);

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < poolSize; attempt++) {
    const apiKey = advanceCursor(provider);
    try {
      return await callOpenAICompatOnce(baseUrl, apiKey, opts);
    } catch (err) {
      lastErr = err as Error;
      const msg = lastErr.message;
      // Only retry on rate limit or transient upstream errors. Anything
      // else (bad payload, auth failure, model not found) is terminal —
      // rotating keys won't help.
      const transient = /\s(408|409|425|429|500|502|503|504|529)\b/.test(msg);
      if (!transient) throw lastErr;
    }
  }
  throw lastErr ?? new Error(`${provider}: all keys exhausted`);
}
