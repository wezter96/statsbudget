import { useMemo, useState } from 'react';
import { Check, Filter, X } from 'lucide-react';
import { stableColor } from '@/lib/palette';
import { useAreaName } from '@/lib/area-i18n';
import { cn } from '@/lib/utils';
import type { DimArea } from '@/lib/supabase-types';

interface Props {
  areas: DimArea[];
  selected: number[]; // explicit list of selected area ids
  onChange: (next: number[]) => void;
  /** Optional ranking so "Topp N" presets know which areas to pick. */
  rankedAreaIds?: number[];
}

/**
 * Category multi-select — filters the time series by utgiftsområde.
 * All categories selected by default; user unchecks to filter.
 */
const CategoryFilter = ({ areas, selected, onChange, rankedAreaIds }: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const localizeArea = useAreaName();

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const isAll = selected.length === areas.length;
  const isNone = selected.length === 0;

  const toggle = (id: number) => {
    const next = selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next);
  };

  const selectAll = () => onChange(areas.map((a) => a.area_id));
  const selectNone = () => onChange([]);

  const setTopN = (n: number) => {
    const ranked = rankedAreaIds ?? areas.map((a) => a.area_id);
    onChange(ranked.slice(0, n));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return areas;
    return areas.filter(
      (a) =>
        a.name_sv.toLowerCase().includes(q) ||
        localizeArea(a.name_sv).toLowerCase().includes(q),
    );
  }, [areas, query, localizeArea]);

  const label = isAll
    ? 'Alla kategorier'
    : isNone
      ? 'Inga kategorier'
      : `${selected.length} av ${areas.length} valda`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/50',
          !isAll && 'border-primary/50 bg-primary/5 text-primary',
        )}
        aria-expanded={open}
      >
        <Filter className="h-3.5 w-3.5" />
        <span className="font-medium">{label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-2 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl bg-card p-3 shadow-xl ring-1 ring-border"
          role="dialog"
          aria-label="Filtrera kategorier"
        >
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök kategori…"
              className="w-full rounded-md bg-muted px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Stäng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
            >
              Alla
            </button>
            <button
              type="button"
              onClick={() => setTopN(5)}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
            >
              Topp 5
            </button>
            <button
              type="button"
              onClick={() => setTopN(10)}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
            >
              Topp 10
            </button>
            <button
              type="button"
              onClick={selectNone}
              className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              Rensa
            </button>
          </div>

          <ul className="max-h-[320px] overflow-y-auto pr-1">
            {filtered.map((a) => {
              const picked = selectedSet.has(a.area_id);
              return (
                <li key={a.area_id}>
                  <button
                    type="button"
                    onClick={() => toggle(a.area_id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                      picked && 'bg-primary/5',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded border',
                        picked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                      )}
                    >
                      {picked && <Check className="h-3 w-3" />}
                    </span>
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-3 rounded-sm"
                      style={{ backgroundColor: stableColor(a.name_sv) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground">{localizeArea(a.name_sv)}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">Inga träffar</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CategoryFilter;
