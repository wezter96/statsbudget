import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

interface Props {
  /** Comma-separated source short names, e.g. "ESV" or "ESV, SCB". */
  sources?: string;
  className?: string;
}

/**
 * Inline chart-caption component. Renders e.g. "Källa: ESV →" where the
 * whole thing links to /about#datakallor so readers can see the full
 * sourcing + license.
 */
const SourceLink = ({ sources = 'ESV', className = '' }: Props) => {
  return (
    <Link
      to="/about#datakallor"
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary hover:underline transition-colors ${className}`}
    >
      <span>Källa: {sources}</span>
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
};

export default SourceLink;
