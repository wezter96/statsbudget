import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import Brand from './Brand';
import { useScrollDirection } from '@/hooks/use-scroll-direction';
import { useLocalizedPath, toSvPath } from '@/lib/lang-route';
import { cn } from '@/lib/utils';

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { direction, atTop } = useScrollDirection();
  const loc = useLocalizedPath();
  const currentSvPath = toSvPath(location.pathname);

  const links = [
    { to: '/', label: t('nav.explorer') },
    { to: '/historical', label: t('nav.historical') },
    { to: '/skatteutgifter', label: t('nav.skatteutgifter') },
    { to: '/about', label: t('nav.about') },
  ];

  // Hide header when scrolling down past the top; always show at top and on scroll-up.
  const hidden = direction === 'down' && !atTop;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-lg',
        'supports-[backdrop-filter]:bg-background/70',
        'transition-transform duration-300 ease-out motion-reduce:transition-none',
        hidden ? '-translate-y-full' : 'translate-y-0',
      )}
    >
      <div className="container flex h-14 items-center justify-between">
        <Brand />
        <nav aria-label="Huvudnavigation" className="flex gap-1 sm:gap-2">
          {links.map((link) => {
            const active = currentSvPath === link.to;
            return (
              <Link
                key={link.to}
                to={loc(link.to)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-secondary text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};

export default Header;
