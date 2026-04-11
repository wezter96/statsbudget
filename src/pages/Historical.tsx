import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { getHistoricalSnapshot, getAreas, convertAmount, formatAmount } from '@/lib/budget-queries';
import type { DimArea } from '@/lib/supabase-types';
import { BarListSkeleton } from '@/components/Skeletons';

const SNAPSHOT_YEARS = [1975, 1980, 1985];

const HistoricalPage = () => {
  const { t } = useTranslation();

  return (
    <Layout>
      <Helmet>
        <title>{t('historical.heading')} — Budgetkoll</title>
        <meta name="description" content={t('historical.intro')} />
      </Helmet>
      <section className="py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('historical.heading')}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {t('historical.intro')}
          </p>

          <div className="mt-12 space-y-16">
            {SNAPSHOT_YEARS.map(year => (
              <SnapshotSection key={year} year={year} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

const SnapshotSection = ({ year }: { year: number }) => {
  const { t } = useTranslation();
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: getAreas });
  const { data: snapshot, isLoading } = useQuery({
    queryKey: ['historical', year],
    queryFn: () => getHistoricalSnapshot(year),
  });

  const items = (() => {
    if (!snapshot || !areas) return [];
    const govData = snapshot.filter(f => f.budget_type !== 'shadow_delta');
    const total = govData.reduce((s, f) => s + f.amount_nominal_sek, 0);
    return govData
      .map(f => {
        const area = areas.find((a: DimArea) => a.area_id === f.area_id);
        return area ? {
          name: area.name_sv,
          pct: total > 0 ? (f.amount_nominal_sek / total) * 100 : 0,
        } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.pct - a.pct) as { name: string; pct: number }[];
  })();

  return (
    <div>
      <h2 className="font-display text-2xl font-semibold text-foreground">{year}</h2>
      <div className="mt-4">
        {isLoading ? (
          <BarListSkeleton />
        ) : items.length > 0 ? (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{item.name}</p>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground shrink-0">{item.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('explorer.noData')}</p>
        )}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {t('historical.placeholder')}
      </p>
      <span className="mt-2 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
        {t('historical.source')}: ESV
      </span>
    </div>
  );
};

export default HistoricalPage;
