// Model picker options. Curated shortlist — must be a subset of the
// registry in supabase/functions/chat/providers.ts. The edge function
// validates `model` against that registry and falls back to CHAT_MODEL
// on mismatch, so adding a model here without also registering it on
// the backend is a no-op.
//
// To expand this list, first confirm the model id is callable with
// your key:
//   Groq:   curl -s https://api.groq.com/openai/v1/models \
//             -H "Authorization: Bearer $GROQ_API_KEY" | jq '.data[].id'
//   NVIDIA: curl -s https://integrate.api.nvidia.com/v1/models \
//             -H "Authorization: Bearer $NVIDIA_API_KEY" | jq '.data[].id'

export interface ChatModelOption {
  id: string;
  label: string;
  provider: 'groq' | 'nvidia';
  /** Short hint shown in the dropdown (size, strength, etc). */
  hint?: string;
}

export const CHAT_MODEL_OPTIONS: ChatModelOption[] = [
  // --- Groq ---
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B',
    provider: 'groq',
    hint: 'Fast, reliable tools',
  },
  {
    id: 'groq-kimi-k2',
    label: 'Kimi K2',
    provider: 'groq',
    hint: 'Strong agentic',
  },
  {
    id: 'gpt-oss-120b',
    label: 'GPT-OSS 120B',
    provider: 'groq',
    hint: 'OpenAI open weights',
  },

  // --- NVIDIA NIM ---
  {
    id: 'kimi-k2-thinking',
    label: 'Kimi K2 Thinking',
    provider: 'nvidia',
    hint: 'Reasoning',
  },
  {
    id: 'glm-4.7',
    label: 'GLM 4.7',
    provider: 'nvidia',
    hint: 'Agentic',
  },
  {
    id: 'qwen3-coder-480b',
    label: 'Qwen3 Coder 480B',
    provider: 'nvidia',
    hint: 'Large MoE, tools',
  },
];

export const DEFAULT_CHAT_MODEL_ID = 'llama-3.3-70b-versatile';
