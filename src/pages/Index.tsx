import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import Hero from '@/components/Hero';
import Explorer from '@/components/explorer/Explorer';
import LangMeta from '@/components/LangMeta';
import { getOgImageUrl } from '@/lib/site-runtime';

const Index = () => {
  const { t } = useTranslation();
  const { search } = useLocation();
  const ogImage = getOgImageUrl(Object.fromEntries(new URLSearchParams(search)));

  return (
    <Layout>
      <LangMeta svPath="/" search={search} />
      <Helmet>
        <title>{t('site.tagline')} — Statsbudget</title>
        <meta name="description" content={t('site.description')} />
        <meta property="og:title" content={t('site.tagline')} />
        <meta property="og:description" content={t('site.description')} />
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        {ogImage && <meta name="twitter:image" content={ogImage} />}
      </Helmet>
      <Hero />
      <Explorer />
    </Layout>
  );
};

export default Index;
