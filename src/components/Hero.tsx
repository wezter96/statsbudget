import { useTranslation } from 'react-i18next';

const Hero = () => {
  const { t } = useTranslation();

  const scrollToExplorer = () => {
    document.getElementById('explorer')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative flex flex-col items-center justify-center px-4 py-16 sm:py-20 md:min-h-[30vh]">
      <div className="max-w-2xl text-center">
        <h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl md:text-[56px] md:leading-[1.1]">
          {t('hero.heading')}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground sm:text-xl">
          {t('hero.subheading')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>{t('hero.lastUpdated', { date: '2024' })}</span>
          <span className="hidden sm:inline">·</span>
          <span className="rounded-full bg-secondary px-3 py-1">{t('hero.sources')}</span>
        </div>
        <button
          onClick={scrollToExplorer}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t('hero.explore')}
        </button>
      </div>
    </section>
  );
};

export default Hero;
