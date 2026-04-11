import { useTranslation } from 'react-i18next';

interface YearRangeSliderProps {
  min: number;
  max: number;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
}

const YearRangeSlider = ({ min, max, from, to, onChange }: YearRangeSliderProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-foreground">{t('explorer.yearRange')}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={from}
        onChange={e => onChange(Math.min(Number(e.target.value), to), to)}
        className="w-20 accent-primary"
        aria-label="Startår"
      />
      <span className="text-sm tabular-nums text-muted-foreground">{from}–{to}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={to}
        onChange={e => onChange(from, Math.max(Number(e.target.value), from))}
        className="w-20 accent-primary"
        aria-label="Slutår"
      />
    </div>
  );
};

export default YearRangeSlider;
