// __DEV__ only review page for the tax gap shortlist.
//
// Gated behind `import.meta.env.DEV` — in a production build the route
// still mounts but renders a 404. The data source is a hand-curated
// static file at src/pages/dev/tax-gap-items.ts; this page is purely a
// read-only sort/filter surface so we can decide what to ingest.

import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NotFound from './NotFound';
import {
  CATEGORY_LABELS,
  CONFIDENCE_LABELS,
  TAX_GAP_ITEMS,
  sortBySize,
  type Confidence,
  type TaxGapCategory,
  type TaxGapItem,
} from './dev/tax-gap-items';

type SortKey = 'size' | 'category' | 'confidence' | 'name';
type Filter = 'all' | 'covered' | 'uncovered' | 'unquantified';

function formatMdr(n: number | null): string {
  if (n == null) return '—';
  if (n >= 10) return `${n.toFixed(0)} mdr`;
  if (n >= 1) return `${n.toFixed(1)} mdr`;
  return `${(n * 1000).toFixed(0)} mkr`;
}

function confidenceVariant(c: Confidence): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (c) {
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    case 'low':
      return 'outline';
    case 'none':
      return 'destructive';
  }
}

function categoryColor(cat: TaxGapCategory): string {
  switch (cat) {
    case 'esv_covered':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200';
    case 'esv_uncovered':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
    case 'reclassified':
      return 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200';
    case 'abolished':
      return 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200';
    case 'corporate_mechanism':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200';
    case 'loophole':
      return 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200';
    case 'other':
      return 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-200';
  }
}

export default function DevTaxGaps() {
  // Hard gate: in a production build this route never renders.
  if (!import.meta.env.DEV) {
    return <NotFound />;
  }

  const [sortKey, setSortKey] = useState<SortKey>('size');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    let rows: TaxGapItem[] = TAX_GAP_ITEMS;
    if (filter === 'covered') rows = rows.filter((r) => r.in_dataset);
    else if (filter === 'uncovered') rows = rows.filter((r) => !r.in_dataset && r.size_mdr != null);
    else if (filter === 'unquantified') rows = rows.filter((r) => r.size_mdr == null);

    switch (sortKey) {
      case 'size':
        return sortBySize(rows);
      case 'name':
        return [...rows].sort((a, b) => a.name_sv.localeCompare(b.name_sv, 'sv'));
      case 'category':
        return [...rows].sort((a, b) => a.category.localeCompare(b.category));
      case 'confidence': {
        const order: Confidence[] = ['high', 'medium', 'low', 'none'];
        return [...rows].sort(
          (a, b) => order.indexOf(a.confidence) - order.indexOf(b.confidence),
        );
      }
    }
  }, [sortKey, filter]);

  // Totals for the summary card.
  const quantified = TAX_GAP_ITEMS.filter((i) => i.size_mdr != null);
  const totalKnown = quantified.reduce((s, i) => s + (i.size_mdr ?? 0), 0);
  const totalInDataset = quantified
    .filter((i) => i.in_dataset)
    .reduce((s, i) => s + (i.size_mdr ?? 0), 0);
  const totalMissing = totalKnown - totalInDataset;
  const unquantifiedCount = TAX_GAP_ITEMS.filter((i) => i.size_mdr == null).length;

  const headerCell = (key: SortKey, label: string, align: 'left' | 'right' = 'left') => (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <button
        type="button"
        onClick={() => setSortKey(key)}
        className={`text-xs font-medium transition-colors ${
          sortKey === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {label}
        {sortKey === key && ' ↓'}
      </button>
    </TableHead>
  );

  return (
    <Layout>
      <Helmet>
        <title>DEV: Tax gap review</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Badge variant="destructive">DEV</Badge>
              <h1 className="font-display text-2xl">Skattebortfall — granskningslista</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Hand-kurerad lista över poster som minskar statens skatteintäkter men som antingen
              saknas i vårt dataset, reklassificerats bort ur ESV-bilagan, eller aldrig bokförts
              officiellt. Endast synlig i utvecklingsläge.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/skatteutgifter">Till skatteutgifter</Link>
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Summa kvantifierat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl">{Math.round(totalKnown)} mdr</div>
              <div className="text-[10px] text-muted-foreground">
                {quantified.length} poster
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Redan i dataset
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl text-emerald-700 dark:text-emerald-300">
                {Math.round(totalInDataset)} mdr
              </div>
              <div className="text-[10px] text-muted-foreground">
                {quantified.filter((i) => i.in_dataset).length} poster
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Saknas, kvantifierat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl text-amber-700 dark:text-amber-300">
                {Math.round(totalMissing)} mdr
              </div>
              <div className="text-[10px] text-muted-foreground">
                {quantified.filter((i) => !i.in_dataset).length} poster
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                Ej kvantifierat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl text-zinc-600 dark:text-zinc-400">
                {unquantifiedCount}
              </div>
              <div className="text-[10px] text-muted-foreground">kryphål / tidsförskj.</div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {(['all', 'covered', 'uncovered', 'unquantified'] as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="h-7 text-xs"
            >
              {f === 'all' && `Alla (${TAX_GAP_ITEMS.length})`}
              {f === 'covered' &&
                `I dataset (${TAX_GAP_ITEMS.filter((i) => i.in_dataset).length})`}
              {f === 'uncovered' &&
                `Saknas (${TAX_GAP_ITEMS.filter((i) => !i.in_dataset && i.size_mdr != null).length})`}
              {f === 'unquantified' && `Ej kvantifierat (${unquantifiedCount})`}
            </Button>
          ))}
        </div>

        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                {headerCell('name', 'Post')}
                {headerCell('size', 'Storlek', 'right')}
                <TableHead className="text-xs">År</TableHead>
                {headerCell('category', 'Kategori')}
                {headerCell('confidence', 'Säkerhet')}
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Källa / not</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="align-top font-medium">{item.name_sv}</TableCell>
                  <TableCell className="align-top text-right font-mono text-sm">
                    {formatMdr(item.size_mdr)}
                  </TableCell>
                  <TableCell className="align-top text-xs text-muted-foreground">
                    {item.year_of_estimate ?? '—'}
                  </TableCell>
                  <TableCell className="align-top">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium ${categoryColor(
                        item.category,
                      )}`}
                    >
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={confidenceVariant(item.confidence)} className="text-[10px]">
                      {CONFIDENCE_LABELS[item.confidence]}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    {item.in_dataset ? (
                      <Badge variant="default" className="bg-emerald-600 text-[10px]">
                        ✓ i dataset
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        saknas
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[320px] align-top text-[11px] text-muted-foreground">
                    <div className="font-medium text-foreground/80">{item.source}</div>
                    <div className="mt-1 leading-snug">{item.notes_sv}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Källdata: <code>src/pages/dev/tax-gap-items.ts</code>. Lägg till eller korrigera poster
          där. Inga användarsynliga ytor läser från den här filen.
        </p>
      </div>
    </Layout>
  );
}
