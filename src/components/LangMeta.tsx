import { Helmet } from 'react-helmet-async';
import { getCanonicalUrl } from '@/lib/site-runtime';
import { toSvPath, withLangPrefix, useLang } from '@/lib/lang-route';

interface Props {
  /** Canonical Swedish path, e.g. '/', '/about', '/historical' */
  svPath: string;
  /** Optional URL search string to preserve in canonical */
  search?: string;
}

/**
 * Emits per-page language metadata:
 *   <link rel="canonical" href="..." />
 *   <link rel="alternate" hreflang="sv" href="..." />
 *   <link rel="alternate" hreflang="en" href="..." />
 *   <link rel="alternate" hreflang="x-default" href="..." />
 *
 * Drop into every page that has i18n content.
 */
const LangMeta = ({ svPath, search = '' }: Props) => {
  const lang = useLang();
  const svUrl = getCanonicalUrl(withLangPrefix(toSvPath(svPath), 'sv'), search);
  const enUrl = getCanonicalUrl(withLangPrefix(toSvPath(svPath), 'en'), search);
  const canonical = lang === 'en' ? enUrl : svUrl;

  return (
    <Helmet>
      {canonical && <link rel="canonical" href={canonical} />}
      {svUrl && <link rel="alternate" hrefLang="sv" href={svUrl} />}
      {enUrl && <link rel="alternate" hrefLang="en" href={enUrl} />}
      {svUrl && <link rel="alternate" hrefLang="x-default" href={svUrl} />}
      <meta httpEquiv="content-language" content={lang} />
    </Helmet>
  );
};

export default LangMeta;
