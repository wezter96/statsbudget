import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';

const AboutPage = () => {
  const { t } = useTranslation();

  const sections = [
    { key: 'project', content: <p className="text-muted-foreground leading-relaxed">{t('about.project.text')}</p> },
    {
      key: 'sources',
      content: (
        <ul className="space-y-2 text-muted-foreground leading-relaxed">
          <li>
            <a href="https://www.esv.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t('about.sources.esv')}
            </a>
          </li>
          <li>
            <a href="https://www.scb.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t('about.sources.scb')}
            </a>
          </li>
          <li>
            <a href="https://www.riksdagen.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {t('about.sources.riksdagen')}
            </a>
          </li>
        </ul>
      ),
    },
    { key: 'method', content: <p className="text-muted-foreground leading-relaxed">{t('about.method.text')}</p> },
    { key: 'limitations', content: <p className="text-muted-foreground leading-relaxed">{t('about.limitations.text')}</p> },
    {
      key: 'openData',
      content: (
        <div className="text-muted-foreground leading-relaxed">
          <p>{t('about.openData.text')}</p>
          <a
            href="https://github.com/REPLACE_ME/budgetkoll-data"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-primary hover:underline"
          >
            github.com/REPLACE_ME/budgetkoll-data
          </a>
        </div>
      ),
    },
    {
      key: 'reportError',
      content: (
        <div className="text-muted-foreground leading-relaxed">
          <p>{t('about.reportError.text')}</p>
          <a
            href="mailto:feedback@REPLACE_ME"
            className="mt-2 inline-block text-primary hover:underline"
          >
            feedback@REPLACE_ME
          </a>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <Helmet>
        <title>{t('about.heading')} — Budgetkoll</title>
        <meta name="description" content={t('about.project.text')} />
      </Helmet>
      <section className="py-12 sm:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            {t('about.heading')}
          </h1>

          <div className="mt-10 space-y-10">
            {sections.map(s => (
              <div key={s.key} className="border-b border-border pb-8 last:border-b-0">
                <h2 className="font-display text-xl font-semibold text-foreground mb-3">
                  {t(`about.${s.key}.title`)}
                </h2>
                {s.content}
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default AboutPage;
