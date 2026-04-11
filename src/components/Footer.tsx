import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="container">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">{t('footer.about')}</h3>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {t('about.project.title')}
            </Link>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">{t('footer.data')}</h3>
            <p className="text-sm text-muted-foreground">{t('footer.sources')}</p>
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">{t('footer.reportError')}</h3>
            <a href="mailto:feedback@REPLACE_ME" className="text-sm text-primary hover:underline">
              feedback@REPLACE_ME
            </a>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground">{t('footer.sources')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
