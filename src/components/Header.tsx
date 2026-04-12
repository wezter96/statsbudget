import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/', label: t('nav.explorer') },
    { to: '/historical', label: t('nav.historical') },
    { to: '/skatteutgifter', label: t('nav.skatteutgifter') },
    { to: '/about', label: t('nav.about') },
  ];

  const hidden = direction === 'down' && !atTop && !menuOpen;

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
        <Brand className="shrink-0" />

        {/* Desktop nav */}
        <nav aria-label="Huvudnavigation" className="hidden sm:flex gap-1.5">
          {links.map((link) => {
            const active = currentSvPath === link.to;
            return (
              <Link
                key={link.to}
                to={loc(link.to)}
                aria-current={active ? 'page' : undefined}
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

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          className="sm:hidden rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label={menuOpen ? 'Stäng meny' : 'Öppna meny'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <nav
          aria-label="Mobilnavigation"
          className="sm:hidden border-t border-border/60 bg-background/95 backdrop-blur-lg animate-in slide-in-from-top-2 fade-in duration-200"
        >
          <div className="container py-2 flex flex-col gap-1">
            {links.map((link) => {
              const active = currentSvPath === link.to;
              return (
                <Link
                  key={link.to}
                  to={loc(link.to)}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
