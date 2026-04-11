import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PlausibleAnalytics from "@/components/PlausibleAnalytics";
import LangSync from "@/components/LangSync";
import { routerBasename } from "@/lib/site-runtime";
import '@/lib/i18n';
import Index from "./pages/Index";
import Historical from "./pages/Historical";
import About from "./pages/About";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const withLang = (el: React.ReactElement) => <LangSync>{el}</LangSync>;

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter basename={routerBasename === "/" ? undefined : routerBasename}>
          <PlausibleAnalytics />
          <Routes>
            {/* Swedish (default, no prefix) */}
            <Route path="/" element={withLang(<Index />)} />
            <Route path="/historical" element={withLang(<Historical />)} />
            <Route path="/about" element={withLang(<About />)} />

            {/* English (/en prefix) */}
            <Route path="/en" element={withLang(<Index />)} />
            <Route path="/en/historical" element={withLang(<Historical />)} />
            <Route path="/en/about" element={withLang(<About />)} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
