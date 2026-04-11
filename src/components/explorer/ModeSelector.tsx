import { useTranslation } from 'react-i18next';
import type { DisplayMode } from '@/lib/supabase-types';

interface ModeSelectorProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

const modes: DisplayMode[] = ['total_pct', 'real', 'nominal', 'gdp_pct'];

const ModeSelector = ({ mode, onChange }: ModeSelectorProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex overflow-x-auto rounded-xl bg-secondary p-1" role="radiogroup" aria-label="Visningsläge">
      {modes.map(m => (
        <button
          key={m}
          role="radio"
          aria-checked={mode === m}
          onClick={() => onChange(m)}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
            mode === m
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(`explorer.mode.${m}`)}
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;
