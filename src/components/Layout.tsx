import { useTranslation } from 'react-i18next';
import { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-to-content">
        {t('a11y.skipToContent')}
      </a>
      <Header />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
