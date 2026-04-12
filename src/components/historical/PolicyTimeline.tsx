import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TIMELINE_EVENTS,
  type ImpactDirection,
  type TimelineEvent,
} from '@/pages/historical/timeline-events';

const DECADE_LABELS = ['1970', '1980', '1990', '2000', '2010', '2020'] as const;

function impactColor(d: ImpactDirection): string {
  switch (d) {
    case 'positive':
      return 'bg-emerald-500';
    case 'negative':
      return 'bg-rose-500';
    case 'structural':
      return 'bg-sky-500';
    case 'mixed':
      return 'bg-amber-500';
  }
}

function impactBadge(d: ImpactDirection): {
  variant: 'default' | 'secondary' | 'outline' | 'destructive';
  label_sv: string;
  label_en: string;
} {
  switch (d) {
    case 'positive':
      return { variant: 'default', label_sv: 'Ökade intäkter', label_en: 'Increased revenue' };
    case 'negative':
      return { variant: 'destructive', label_sv: 'Minskade intäkter', label_en: 'Reduced revenue' };
    case 'structural':
      return { variant: 'secondary', label_sv: 'Strukturell', label_en: 'Structural' };
    case 'mixed':
      return { variant: 'outline', label_sv: 'Blandat', label_en: 'Mixed' };
  }
}

function formatMdr(n: number): string {
  return `~${n} mdr kr`;
}

function EventCard({ event, isEn }: { event: TimelineEvent; isEn: boolean }) {
  const badge = impactBadge(event.impact);
  return (
    <div className="group relative flex gap-4">
      {/* Dot on the timeline */}
      <div className="relative flex flex-col items-center">
        <div
          className={`z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-background ${impactColor(event.impact)}`}
        />
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-semibold text-foreground">
            {event.year}
          </span>
          <Badge variant={badge.variant} className="text-[10px]">
            {isEn ? badge.label_en : badge.label_sv}
          </Badge>
          {event.estimated_impact_mdr != null && (
            <span className="text-xs font-medium text-muted-foreground">
              {formatMdr(event.estimated_impact_mdr)}
            </span>
          )}
        </div>
        <h3 className="mt-1 text-sm font-semibold text-foreground">
          {isEn ? event.title_en : event.title_sv}
        </h3>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {isEn ? event.description_en : event.description_sv}
        </p>
        {event.source_label && (
          <div className="mt-1.5">
            {event.source_url ? (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-primary hover:underline"
              >
                {event.source_label} ↗
              </a>
            ) : (
              <span className="inline-flex rounded-full bg-secondary px-2.5 py-0.5 text-[10px] text-muted-foreground">
                {event.source_label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type FilterImpact = 'all' | ImpactDirection;

export default function PolicyTimeline() {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const [filter, setFilter] = useState<FilterImpact>('all');

  const filtered = useMemo(() => {
    const base = filter === 'all' ? TIMELINE_EVENTS : TIMELINE_EVENTS.filter((e) => e.impact === filter);
    return [...base].sort((a, b) => a.year - b.year);
  }, [filter]);

  const filters: { key: FilterImpact; label: string }[] = [
    { key: 'all', label: isEn ? 'All' : 'Alla' },
    { key: 'negative', label: isEn ? 'Reduced revenue' : 'Minskade intäkter' },
    { key: 'positive', label: isEn ? 'Increased revenue' : 'Ökade intäkter' },
    { key: 'structural', label: isEn ? 'Structural' : 'Strukturella' },
    { key: 'mixed', label: isEn ? 'Mixed' : 'Blandat' },
  ];

  return (
    <section className="mt-16 mb-16" id="tidslinje">
      <header className="mb-6 max-w-3xl">
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
          {isEn ? 'Tax policy timeline' : 'Skattepolitisk tidslinje'}
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          {isEn
            ? 'Major reforms and decisions that have shaped Swedish tax revenue from 1970 to today. Green = increased revenue. Red = decreased revenue.'
            : 'Stora reformer och beslut som format Sveriges skatteintäkter från 1970 till idag. Grönt = ökade intäkter. Rött = minskade intäkter.'}
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
            className="h-7 text-xs"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Decade markers + event list */}
      <div className="relative">
        {filtered.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">
            {isEn ? 'No events match this filter.' : 'Inga händelser matchar filtret.'}
          </p>
        ) : (
          <div>
            {filtered.map((event, i) => {
              const prevDecade = i > 0 ? Math.floor(filtered[i - 1].year / 10) : -1;
              const curDecade = Math.floor(event.year / 10);
              const showDecade = curDecade !== prevDecade;
              return (
                <div key={`${event.year}-${event.title_sv}`}>
                  {showDecade && (
                    <div className="mb-4 mt-2 flex items-center gap-3">
                      <div className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        {curDecade * 10}-tal
                      </div>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <EventCard event={event} isEn={isEn} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground">
        {isEn
          ? 'Sources: Riksdagen, Finansdepartementet, ESV, Riksrevisionen. Amounts are rough annual estimates in today\'s terms.'
          : 'Källor: Riksdagen, Finansdepartementet, ESV, Riksrevisionen. Belopp är ungefärliga årseffekter i dagens penningvärde.'}
      </p>
    </section>
  );
}
