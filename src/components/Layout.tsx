import { useTranslation } from 'react-i18next';
import { ReactNode, useState } from 'react';
import Header from './Header';
import Footer from './Footer';
import { ChatDrawer } from './chat/ChatDrawer';
import { ChatTrigger } from './chat/ChatTrigger';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation();
  const [chatOpen, setChatOpen] = useState(false);

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
      <ChatTrigger onClick={() => setChatOpen(true)} />
      <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
};

export default Layout;
