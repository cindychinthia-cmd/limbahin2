import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { queryClientInstance } from '@/lib/query-client';
import PageNotFound from '@/lib/PageNotFound';
import ScrollToTop from '@/components/ScrollToTop';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import TambahReferal from '@/pages/TambahReferal';
import { SettingsProvider } from '@/settings/SettingsContext';

// "/" is the only customer-facing path. Staff utilities remain unlisted.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/tambahreferal" element={<TambahReferal />} />
      <Route path="/settings/:location" element={<Settings />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <Router>
        <SettingsProvider>
          <ScrollToTop />
          <AppRoutes />
        </SettingsProvider>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}
