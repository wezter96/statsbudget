import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import Layout from '@/components/Layout';
import FeedbackForm from '@/components/FeedbackForm';
import LangMeta from '@/components/LangMeta';
import { SOURCES } from '@/lib/sources';
import { getOgImageUrl } from '@/lib/site-runtime';

const AboutPage = () => {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const ogImage = getOgImageUrl({ about: 1 });

  // Smooth-scroll to hash target when arriving from a chart-caption link
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  const sections = [
    { key: 'project', id: 'projektet', content: <p className="text-muted-foreground leading-relaxed">{t('about.project.text')}</p> },
    {
      key: 'sources',
      id: 'datakallor',
      content: (
        <ul className="space-y-5">
          {SOURCES.map((s) => (
            <li
              key={s.id}
              id={`kalla-${s.id}`}
              className="rounded-xl bg-card p-4 ring-1 ring-border/60 scroll-mt-24"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {s.name}
                </h3>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  {new URL(s.url).host}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.description}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {s.fields.map((f) => (
                  <li
                    key={f}
                    className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {f}
                  </li>
                ))}
              </ul>
              {s.datasetUrl && (
                <a
                  href={s.datasetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Öppna dataset
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
      ),
    },
    { key: 'method', id: 'metod', content: <p className="text-muted-foreground leading-relaxed">{t('about.method.text')}</p> },
    { key: 'limitations', id: 'begransningar', content: <p className="text-muted-foreground leading-relaxed">{t('about.limitations.text')}</p> },
    {
      key: 'openData',
      id: 'oppen-data',
      content: (
        <div className="text-muted-foreground leading-relaxed">
          <p>{t('about.openData.text')}</p>
          <a
            href="https://github.com/wezter96/statsbudget"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-primary hover:underline"
          >
            github.com/wezter96/statsbudget
          </a>
        </div>
      ),
    },
    {
      key: 'reportError',
      id: 'rapportera-fel',
      content: (
        <div className="space-y-4">
          <p className="text-muted-foreground leading-relaxed">{t('about.reportError.text')}</p>
          <FeedbackForm />
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <LangMeta svPath="/about" />
      <Helmet>
        <title>{t('about.heading')} — Statsbudget</title>
        <meta name="description" content={t('about.project.text')} />
        <meta property="og:title" content={t('about.heading')} />
        <meta property="og:description" content={t('about.project.text')} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      <section className="py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('about.heading')}
          </h1>

          <div className="mt-10 space-y-10">
            {sections.map((s) => (
              <section
                key={s.key}
                id={s.id}
                className="scroll-mt-24 border-b border-border pb-8 last:border-b-0"
              >
                <h2 className="mb-3 font-display text-xl font-semibold text-foreground">
                  {t(`about.${s.key}.title`)}
                </h2>
                {s.content}
              </section>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AboutPage;
