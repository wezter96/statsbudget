import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useChat } from './use-chat';

interface ChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDrawer({ open, onOpenChange }: ChatDrawerProps) {
  const { t } = useTranslation();
  const { messages, status, sendMessage, clear, error } = useChat();

  const suggestionsRaw = t('chat.suggestions', { returnObjects: true }) as unknown;
  const suggestions: string[] = Array.isArray(suggestionsRaw) ? (suggestionsRaw as string[]) : [];
  const isStreaming = status === 'streaming';
  const isNotConfigured = status === 'server_not_configured';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[420px] backdrop-blur supports-[backdrop-filter]:bg-background/95"
      >
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="font-display text-base">{t('chat.title')}</SheetTitle>
              <SheetDescription className="text-[11px]">
                statsbudget.se · AI
              </SheetDescription>
            </div>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="h-8 gap-1 text-xs"
                aria-label={t('chat.clear')}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('chat.clear')}
              </Button>
            )}
          </div>
        </SheetHeader>

        {isNotConfigured ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
            <p>{t('chat.serverNotConfigured')}</p>
            <a
              href="/about#rapportera-fel"
              className="text-primary underline underline-offset-4"
            >
              {t('chat.reportErrorLink')}
            </a>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
            <p className="text-sm text-muted-foreground">{t('chat.emptyState')}</p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(s)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm text-card-foreground transition-colors hover:border-primary/40 hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ChatMessages messages={messages} streaming={isStreaming} />
        )}

        {status === 'error' && (
          <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {t('chat.error')} {error ? <span className="opacity-60">({error})</span> : null}
          </div>
        )}

        {!isNotConfigured && <ChatInput onSend={sendMessage} disabled={isStreaming} />}
      </SheetContent>
    </Sheet>
  );
}
