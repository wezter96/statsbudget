import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ChatTriggerProps {
  onClick: () => void;
}

export function ChatTrigger({ onClick }: ChatTriggerProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('chat.trigger')}
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-[1.04] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
    >
      <Sparkles className="h-6 w-6" aria-hidden="true" />
    </button>
  );
}
