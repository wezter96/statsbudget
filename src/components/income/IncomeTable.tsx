import { Fragment, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { stableColor } from '@/lib/palette';
import { getIncomeSubtitles } from '@/lib/budget-queries';
import { cn } from '@/lib/utils';
import type { DimIncomeTitle, FactIncome } from '@/lib/supabase-types';

export interface IncomeGroupRow {
  group: DimIncomeTitle;
  amount_mkr: number;
  pct: number;
  changePct: number | null;
  is_estimated: boolean;
}

interface Props {
  rows: IncomeGroupRow[];
  year: number;
  facts: FactIncome[];
  search: string;
  expandedGroupId: number | null;
  onToggleGroup: (id: number) => void;
}

const IncomeTable = ({ rows, year, facts, search, expandedGroupId, onToggleGroup }: Props) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');

  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} ${t('skatteintakter.unit')}`;
  };

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => {
      const name = (isEn && r.group.name_en ? r.group.name_en : r.group.name_sv).toLowerCase();
      const desc = (r.group.description_sv ?? '').toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [rows, search, isEn]);

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium w-8" aria-hidden="true" />
            <th className="px-4 py-2 font-medium">{t('skatteintakter.col.name')}</th>
            <th className="px-4 py-2 font-medium text-right">{t('skatteintakter.col.amount')}</th>
            <th className="px-4 py-2 font-medium text-right hidden sm:table-cell">{t('skatteintakter.col.share')}</th>
            <th className="px-4 py-2 font-medium text-right hidden sm:table-cell">{t('skatteintakter.col.change')}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => {
            const name = isEn && r.group.name_en ? r.group.name_en : r.group.name_sv;
            const color = stableColor(r.group.name_sv);
            const isExpanded = expandedGroupId === r.group.income_title_id;
            return (
              <Fragment key={r.group.income_title_id}>
                <tr
                  className={cn(
                    'border-t border-border cursor-pointer hover:bg-muted/30 transition-colors',
                    isExpanded && 'bg-primary/10',
                  )}
                  onClick={() => onToggleGroup(r.group.income_title_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onToggleGroup(r.group.income_title_id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isExpanded}
                >
                  <td className="px-4 py-3">
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform duration-200',
                        !isExpanded && '-rotate-90',
                      )}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="font-medium text-foreground">{name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {fmtMkr(r.amount_mkr)}
                    {r.is_estimated && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({t('skatteintakter.estimated')})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                    {r.pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                    {r.changePct != null ? (
                      <span className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium leading-none',
                        r.changePct > 0 ? 'bg-green-100 text-green-700' : r.changePct < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500',
                      )}>
                        {r.changePct > 0 ? '+' : ''}{r.changePct.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <td colSpan={5} className="p-0 border-0">
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300 ease-in-out',
                        isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="bg-muted/30 px-4 py-3">
                          <SubtitleBreakdown
                            parentId={r.group.income_title_id}
                            parentName={r.group.name_sv}
                            facts={facts}
                            year={year}
                          />
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                {t('skatteintakter.noMatch')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

interface SubtitleBreakdownProps {
  parentId: number;
  parentName: string;
  facts: FactIncome[];
  year: number;
}

const SubtitleBreakdown = ({ parentId, parentName, facts, year }: SubtitleBreakdownProps) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const fmtMkr = (v: number) => {
    const locale = isEn ? 'en-GB' : 'sv-SE';
    return `${new Intl.NumberFormat(locale).format(Math.round(v))} ${t('skatteintakter.unit')}`;
  };

  const { data: subtitles, isLoading } = useQuery({
    queryKey: ['income-subtitles', parentId],
    queryFn: () => getIncomeSubtitles(parentId),
  });

  const rows = useMemo(() => {
    if (!subtitles) return [];
    const factById = new Map<number, number>();
    for (const f of facts) factById.set(f.income_title_id, Number(f.amount_mkr));
    return subtitles
      .map(s => ({
        ...s,
        amount: factById.get(s.income_title_id) ?? 0,
      }))
      .filter(s => s.amount !== 0)
      .sort((a, b) => b.amount - a.amount);
  }, [subtitles, facts]);

  const subTotal = rows.reduce((s, r) => s + r.amount, 0);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('skatteintakter.noData')}</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('skatteintakter.noMatch')}</p>;
  }

  return (
    <ul className="divide-y divide-border/50">
      {rows.map((r) => {
        const name = isEn && r.name_en ? r.name_en : r.name_sv;
        const pct = subTotal > 0 ? (r.amount / subTotal) * 100 : 0;
        return (
          <li key={r.income_title_id} className="flex items-center justify-between gap-2 py-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: stableColor(r.name_sv) }}
              />
              <span className="truncate text-foreground">{name}</span>
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 shrink-0 tabular-nums whitespace-nowrap">
              <span className="text-foreground">{fmtMkr(r.amount)}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{pct.toFixed(1)}%</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default IncomeTable;
