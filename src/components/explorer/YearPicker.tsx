import { useTranslation } from 'react-i18next';

interface YearPickerProps {
  years: number[];
  selectedYear: number;
  onChange: (year: number) => void;
}

const YearPicker = ({ years, selectedYear, onChange }: YearPickerProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="year-picker" className="text-sm font-medium text-foreground">
        {t('explorer.year')}
      </label>
      <select
        id="year-picker"
        value={selectedYear}
        onChange={e => onChange(Number(e.target.value))}
        className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};

export default YearPicker;
