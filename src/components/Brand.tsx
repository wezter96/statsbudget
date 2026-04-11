import { Link } from 'react-router-dom';
import { useLocalizedPath } from '@/lib/lang-route';

interface Props {
  className?: string;
}

/** Donut mark + wordmark. Links to home in the active language. */
const Brand = ({ className = '' }: Props) => {
  const loc = useLocalizedPath();
  return (
  <Link
    to={loc('/')}
    className={`inline-flex items-center gap-2.5 ${className}`}
    aria-label="Statsbudget — startsida"
  >
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="h-7 w-7 shrink-0"
    >
      <g transform="translate(16 16)">
        <circle r="11" fill="none" stroke="#E63946" strokeWidth="5" strokeDasharray="17 52" transform="rotate(-90)" />
        <circle r="11" fill="none" stroke="#1D4ED8" strokeWidth="5" strokeDasharray="14 52" strokeDashoffset="-17" transform="rotate(-90)" />
        <circle r="11" fill="none" stroke="#16A34A" strokeWidth="5" strokeDasharray="11 52" strokeDashoffset="-31" transform="rotate(-90)" />
        <circle r="11" fill="none" stroke="#F59E0B" strokeWidth="5" strokeDasharray="10 52" strokeDashoffset="-42" transform="rotate(-90)" />
      </g>
    </svg>
    <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
      Statsbudget
    </span>
  </Link>
  );
};

export default Brand;
