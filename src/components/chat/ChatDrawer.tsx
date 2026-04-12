import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { useChat } from './use-chat';
import { CHAT_MODEL_OPTIONS } from './models';

interface ChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDrawer({ open, onOpenChange }: ChatDrawerProps) {
  const { t } = useTranslation();
  const { messages, status, sendMessage, clear, error, modelId, setModelId } = useChat();
  const groqModels = CHAT_MODEL_OPTIONS.filter((m) => m.provider === 'groq');
  const nvidiaModels = CHAT_MODEL_OPTIONS.filter((m) => m.provider === 'nvidia');

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
        <SheetHeader className="border-b border-border px-4 py-3 pr-12 text-left">
          {/* pr-12 reserves space for the Sheet's built-in absolute close X
              in the top-right corner, so nothing we render here overlaps it. */}
          <div className="flex items-start justify-between gap-2">
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
                className="h-8 shrink-0 gap-1 text-xs"
                aria-label={t('chat.clear')}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('chat.clear')}</span>
              </Button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('chat.model')}
            </label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="h-7 flex-1 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase">Groq</SelectLabel>
                  {groqModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="font-medium">{m.label}</span>
                      {m.hint && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {m.hint}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase">NVIDIA</SelectLabel>
                  {nvidiaModels.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <span className="font-medium">{m.label}</span>
                      {m.hint && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {m.hint}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
