import { Link, useLocation } from 'react-router-dom';
import { useLang, withLangPrefix, toSvPath, type Lang } from '@/lib/lang-route';
import { cn } from '@/lib/utils';

const LANGS: { code: Lang; label: string }[] = [
  { code: 'sv', label: 'SV' },
  { code: 'en', label: 'EN' },
];

/**
 * Segmented SV/EN toggle. Each option is a real `<Link>` so the URL itself
 * changes and crawlers see independent routes per language.
 */
const LanguageToggle = () => {
  const current = useLang();
  const { pathname, search, hash } = useLocation();
  const svPath = toSvPath(pathname);

  return (
    <div
      role="group"
      aria-label="Språk / Language"
      className="inline-flex items-center gap-0.5 rounded-full bg-secondary p-0.5"
    >
      {LANGS.map(({ code, label }) => {
        const target = withLangPrefix(svPath, code) + search + hash;
        const active = current === code;
        return (
          <Link
            key={code}
            to={target}
            hrefLang={code}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
};

export default LanguageToggle;
