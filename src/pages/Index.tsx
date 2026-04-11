import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import Layout from '@/components/Layout';
import Hero from '@/components/Hero';
import Explorer from '@/components/explorer/Explorer';

const Index = () => {
  const { t } = useTranslation();

  return (
    <Layout>
      <Helmet>
        <title>{t('site.tagline')} — Budgetkoll</title>
        <meta name="description" content={t('site.description')} />
        <meta property="og:title" content={t('site.tagline')} />
        <meta property="og:description" content={t('site.description')} />
      </Helmet>
      <Hero />
      <Explorer />
    </Layout>
  );
};

export default Index;
