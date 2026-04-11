import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const links = [
    { to: '/', label: t('nav.explorer') },
    { to: '/historical', label: t('nav.historical') },
    { to: '/about', label: t('nav.about') },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="font-display text-xl font-semibold text-foreground">
          Budgetkoll
        </Link>
        <nav aria-label="Huvudnavigation" className="flex gap-6">
          {links.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === link.to ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
