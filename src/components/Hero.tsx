import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const Hero = () => {
  const { t } = useTranslation();

  const lastUpdated = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <section className="px-4 pt-8 pb-6 sm:pt-12 sm:pb-8">
      <div className="container max-w-3xl">
        <h1 className="font-display text-[38px] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-[56px]">
          {t('hero.heading')}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t('hero.subheading')}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{t('hero.lastUpdated', { date: lastUpdated })}</span>
          <span aria-hidden="true">·</span>
          <Link to="/about#datakallor" className="text-muted-foreground hover:text-primary transition-colors">
            {t('hero.sources')}
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
