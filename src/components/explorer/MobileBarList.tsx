import { formatAmount } from '@/lib/budget-queries';
import { stableColor } from '@/lib/palette';
import { useAreaName } from '@/lib/area-i18n';
import type { DimArea, DisplayMode } from '@/lib/supabase-types';

interface BarItem {
  area: DimArea;
  value: number;
  pct: number;
}

interface MobileBarListProps {
  data: BarItem[];
  mode: DisplayMode;
  onAreaClick: (areaId: number) => void;
}

const MobileBarList = ({ data, mode, onAreaClick }: MobileBarListProps) => {
  const localizeArea = useAreaName();
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const maxVal = sorted[0]?.value || 1;

  return (
    <div className="space-y-2">
      {sorted.map((item) => (
        <button
          key={item.area.area_id}
          onClick={() => onAreaClick(item.area.area_id)}
          className="flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className="inline-block h-8 w-1 rounded-sm shrink-0"
            style={{ backgroundColor: stableColor(item.area.name_sv) }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{localizeArea(item.area.name_sv)}</p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(item.value / maxVal) * 100}%`, backgroundColor: stableColor(item.area.name_sv) }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium tabular-nums text-foreground">{formatAmount(item.value, mode)}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{item.pct.toFixed(1)}%</p>
          </div>
        </button>
      ))}
    </div>
  );
};

export default MobileBarList;
