import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Nav';
import { LandingPage } from './pages/Landing';
import { WalletPage } from './pages/Wallet';
import { OrganizerPage } from './pages/Organizer';
import { AttendeePage } from './pages/Attendee';
import { VerifyPage } from './pages/Verify';

export function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/organizer" element={<OrganizerPage />} />
          <Route path="/attend" element={<AttendeePage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
