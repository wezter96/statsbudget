import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from './use-chat';

interface ChatMessagesProps {
  messages: ChatMessage[];
  streaming: boolean;
}

export function ChatMessages({ messages, streaming }: ChatMessagesProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
      aria-live="polite"
      aria-atomic="false"
    >
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            'flex flex-col gap-1',
            msg.role === 'user' ? 'items-end' : 'items-start',
          )}
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {msg.role === 'user' ? t('chat.you') : t('chat.assistant')}
          </span>

          {msg.toolUses && msg.toolUses.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {msg.toolUses.map((tool, i) => (
                <span
                  key={`${msg.id}-tool-${i}`}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
                  title={JSON.stringify(tool.input)}
                >
                  <Wrench className="h-3 w-3" aria-hidden="true" />
                  {t('chat.toolUsed')}: <code className="font-mono">{tool.name}</code>
                </span>
              ))}
            </div>
          )}

          <div
            className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground border border-border',
            )}
          >
            {msg.role === 'assistant' ? (
              <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || '…'}</ReactMarkdown>
                {msg.pending && streaming && (
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary/60 ml-1 align-middle" />
                )}
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
