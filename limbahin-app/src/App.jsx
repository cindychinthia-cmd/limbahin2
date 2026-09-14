import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import Home from '@/pages/Home';
import Settings from '@/pages/Settings';
import TambahReferal from '@/pages/TambahReferal';
import Registrasi from '@/pages/Registrasi';
import SubmissionResult from '@/pages/SubmissionResult';
import { SettingsProvider } from '@/settings/SettingsContext';
// Add page imports here

// NOTE: this app no longer depends on base44 for auth/session — the quotation +
// registration wizard is fully public (no login wall). /tambahreferal and /settings are
// unlisted/"hidden" routes: reachable by anyone who has the link, but not linked from the UI.
// If you want them password-protected later, that's a small addition on top of this.

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/registrasi" element={<Registrasi />} />
      <Route path="/hasil" element={<SubmissionResult />} />
      <Route path="/tambahreferal" element={<TambahReferal />} />
      <Route path="/settings/:location" element={<Settings />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
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
  )
}

export default App
