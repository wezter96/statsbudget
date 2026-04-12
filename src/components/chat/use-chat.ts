import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CHAT_MODEL_OPTIONS, DEFAULT_CHAT_MODEL_ID } from './models';

// Types ---------------------------------------------------------------------

export interface ToolUse {
  name: string;
  input: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  toolUses?: ToolUse[];
  /** Only set on the streaming assistant message until it finishes. */
  pending?: boolean;
}

export type ChatStatus = 'idle' | 'streaming' | 'error' | 'server_not_configured';

interface UseChatOptions {
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'statsbudget-chat-v1';
const MODEL_STORAGE_KEY = 'statsbudget-chat-model-v1';

const VALID_MODEL_IDS = new Set(CHAT_MODEL_OPTIONS.map((m) => m.id));

function loadModelId(): string {
  if (typeof window === 'undefined') return DEFAULT_CHAT_MODEL_ID;
  try {
    const raw = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (raw && VALID_MODEL_IDS.has(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CHAT_MODEL_ID;
}

function loadMessages(key: string): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.map((m) => ({ ...m, pending: false })) : [];
  } catch {
    return [];
  }
}

function saveMessages(key: string, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(messages));
  } catch {
    /* quota or serialization — drop silently */
  }
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Shape required by the edge function. We rehydrate our local ChatMessage
 * list into the Anthropic-flavoured wire format.
 */
function toWireMessages(messages: ChatMessage[]) {
  return messages
    .filter((m) => m.text.trim().length > 0 || (m.role === 'user'))
    .map((m) => ({ role: m.role, content: m.text }));
}

export function useChat(options: UseChatOptions = {}) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const { i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(storageKey));
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [modelId, setModelIdState] = useState<string>(() => loadModelId());
  const abortRef = useRef<AbortController | null>(null);

  const setModelId = useCallback((id: string) => {
    if (!VALID_MODEL_IDS.has(id)) return;
    setModelIdState(id);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MODEL_STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    saveMessages(storageKey, messages);
  }, [messages, storageKey]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStatus('idle');
    setError(null);
    if (typeof window !== 'undefined') window.localStorage.removeItem(storageKey);
  }, [storageKey]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || status === 'streaming') return;

      const userMsg: ChatMessage = { id: newId(), role: 'user', text: trimmed };
      const assistantId = newId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        text: '',
        toolUses: [],
        pending: true,
      };

      const base = [...messages, userMsg];
      setMessages([...base, assistantMsg]);
      setStatus('streaming');
      setError(null);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
        if (!supabaseUrl || !anonKey) {
          throw new Error('missing_supabase_env');
        }
        const res = await fetch(`${supabaseUrl}/functions/v1/chat`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${anonKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({
            messages: toWireMessages(base),
            lang: i18n.language === 'en' ? 'en' : 'sv',
            model: modelId,
          }),
          signal: ac.signal,
        });

        if (res.status === 503) {
          setStatus('server_not_configured');
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          return;
        }
        if (!res.ok || !res.body) {
          throw new Error(`http_${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let eventName = '';
        const appendText = (chunk: string) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + chunk } : m)),
          );
        };
        const appendToolUse = (tool: ToolUse) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolUses: [...(m.toolUses ?? []), tool] }
                : m,
            ),
          );
        };

        // Minimal SSE parser: events are \n\n-separated; each event has
        // "event: <name>" + "data: <json>" lines.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            eventName = '';
            let dataLine = '';
            for (const line of chunk.split('\n')) {
              if (line.startsWith('event:')) eventName = line.slice(6).trim();
              else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
            }
            if (!eventName) continue;
            let data: unknown = null;
            try {
              data = dataLine ? JSON.parse(dataLine) : null;
            } catch {
              /* ignore */
            }
            if (eventName === 'text' && data && typeof (data as { text?: string }).text === 'string') {
              appendText((data as { text: string }).text);
            } else if (eventName === 'tool_use' && data) {
              appendToolUse(data as ToolUse);
            } else if (eventName === 'error' && data) {
              setError((data as { message?: string }).message ?? 'error');
            } else if (eventName === 'done') {
              // nothing
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
        );
        setStatus('idle');
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.error('[chat] send failed', err);
        setError((err as Error).message);
        setStatus('error');
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)),
        );
      }
    },
    [messages, status, i18n.language, modelId],
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  return { messages, status, error, sendMessage, clear, modelId, setModelId };
}
