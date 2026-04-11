import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import Brand from './Brand';
import LanguageToggle from './LanguageToggle';
import { useLocalizedPath } from '@/lib/lang-route';

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const loc = useLocalizedPath();

  return (
    <footer className="mt-16 border-t border-border bg-secondary/40">
      <div className="container py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div className="md:col-span-2">
            <Brand />
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t('footer.tagline')}
            </p>
          </div>
          <div className="flex flex-col items-start gap-4 md:items-end">
            <nav aria-label="Fotnavigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link to={loc('/about')} className="text-muted-foreground hover:text-primary transition-colors">
                {t('footer.about')}
              </Link>
              <Link to={loc('/about') + '#datakallor'} className="text-muted-foreground hover:text-primary transition-colors">
                {t('footer.sourcesLink')}
              </Link>
              <Link to={loc('/about') + '#rapportera-fel'} className="text-muted-foreground hover:text-primary transition-colors">
                {t('footer.reportError')}
              </Link>
            </nav>
            <LanguageToggle />
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6 space-y-3">
          <p className="text-xs text-muted-foreground">
            {t('footer.copyright', { year })}
          </p>
          <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground/90">
            {t('footer.disclaimer')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
