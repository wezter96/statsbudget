import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import {
  getSkatteutgifter,
  getSkatteutgiftFacts,
  getSkatteutgiftTimeSeries,
  getYears,
} from '@/lib/budget-queries';

const SkatteutgifterPage = () => {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();

  const years = useQuery({ queryKey: ['years'], queryFn: getYears });
  const dim = useQuery({ queryKey: ['skatteutgifter-dim'], queryFn: getSkatteutgifter });
  const series = useQuery({
    queryKey: ['skatteutgifter-series'],
    queryFn: getSkatteutgiftTimeSeries,
  });

  const availableYears = (() => {
    if (!series.data) return [];
    const set = new Set<number>();
    for (const f of series.data) set.add(f.year_id);
    return Array.from(set).sort((a, b) => b - a);
  })();

  const defaultYear = availableYears[0] ?? years.data?.at(-1)?.year_id;
  const yearParam = params.get('year');
  const selectedYear = yearParam ? parseInt(yearParam, 10) : defaultYear;

  const facts = useQuery({
    queryKey: ['skatteutgifter-facts', selectedYear],
    queryFn: () => (selectedYear ? getSkatteutgiftFacts(selectedYear) : Promise.resolve([])),
    enabled: selectedYear != null,
  });

  const isEnglish = i18n.language?.startsWith('en');

  const rows = (() => {
    if (!dim.data) return [];
    const factByCode = new Map<number, { amount_mkr: number; is_estimated: boolean }>();
    for (const f of facts.data ?? []) {
      factByCode.set(f.skatteutgift_id, {
        amount_mkr: Number(f.amount_mkr),
        is_estimated: f.is_estimated,
      });
    }
    return dim.data
      .map(d => ({
        ...d,
        amount_mkr: factByCode.get(d.skatteutgift_id)?.amount_mkr ?? null,
        is_estimated: factByCode.get(d.skatteutgift_id)?.is_estimated ?? false,
      }))
      .sort((a, b) => (b.amount_mkr ?? -1) - (a.amount_mkr ?? -1));
  })();

  const total = rows.reduce((s, r) => s + (r.amount_mkr ?? 0), 0);
  const hasData = total > 0;

  const fmtMkr = (v: number) =>
    `${new Intl.NumberFormat(isEnglish ? 'en-GB' : 'sv-SE').format(Math.round(v))} ${t('skatteutgifter.unit')}`;

  return (
    <Layout>
      <Helmet>
        <title>{t('skatteutgifter.title')} — Budgetkoll</title>
        <meta name="description" content={t('skatteutgifter.intro')} />
      </Helmet>

      <section className="border-b border-border bg-muted/40 py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('skatteutgifter.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t('skatteutgifter.intro')}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('skatteutgifter.disclosure')}
          </p>
        </div>
      </section>

      <section className="py-10 sm:py-14">
        <div className="container max-w-5xl">
          <div className="mb-6 flex flex-wrap items-end gap-4">
            <label className="flex flex-col text-sm">
              <span className="mb-1 text-muted-foreground">{t('skatteutgifter.year')}</span>
              <select
                className="rounded-md border border-input bg-background px-3 py-2"
                value={selectedYear ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  const next = new URLSearchParams(params);
                  if (v) next.set('year', v); else next.delete('year');
                  setParams(next, { replace: true });
                }}
              >
                {(availableYears.length > 0 ? availableYears : (years.data ?? []).map(y => y.year_id))
                  .map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
              </select>
            </label>
            {hasData && (
              <div className="text-sm text-muted-foreground">
                {t('skatteutgifter.totalLabel')}: <strong className="text-foreground">{fmtMkr(total)}</strong>
              </div>
            )}
          </div>

          {!hasData && (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              <strong className="text-foreground">{t('skatteutgifter.demoBadge')}</strong>{' '}
              {t('skatteutgifter.noData')}
            </div>
          )}

          {hasData && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">{t('skatteutgifter.col.name')}</th>
                    <th className="px-4 py-2 font-medium">{t('skatteutgifter.col.description')}</th>
                    <th className="px-4 py-2 font-medium text-right">{t('skatteutgifter.col.amount')}</th>
                    <th className="px-4 py-2 font-medium">{t('skatteutgifter.col.area')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.skatteutgift_id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {isEnglish && r.name_en ? r.name_en : r.name_sv}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {(isEnglish && r.description_en) || r.description_sv}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.amount_mkr != null ? fmtMkr(r.amount_mkr) : '—'}
                        {r.is_estimated && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({t('skatteutgifter.estimated')})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.thematic_area_id != null && (
                          <Link
                            to={`/?area=${r.thematic_area_id}`}
                            className="inline-flex rounded-full border border-border bg-background px-2 py-0.5 text-xs text-primary hover:underline"
                          >
                            UO
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-8 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong>{t('skatteutgifter.sourcesLabel')}:</strong>{' '}
              <a
                className="text-primary hover:underline"
                href="https://www.regeringen.se/search?query=skatteutgifter+bilaga"
                target="_blank"
                rel="noopener noreferrer"
              >
                Regeringens skatteutgiftsbilaga
              </a>
              {' · '}
              <a
                className="text-primary hover:underline"
                href="https://www.esv.se/statsbudgetens-utveckling/"
                target="_blank"
                rel="noopener noreferrer"
              >
                ESV inkomstutfall
              </a>
            </p>
            <p>{t('skatteutgifter.caveat')}</p>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default SkatteutgifterPage;
