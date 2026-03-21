import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Layout } from './components/layout/Layout';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { LandingPage } from './pages/LandingPage';
import { ConnectPage } from './pages/ConnectPage';
import { VaultPage } from './pages/VaultPage';
import { PoliciesPage } from './pages/PoliciesPage';
import { AuditPage } from './pages/AuditPage';
import { DemoPage } from './pages/DemoPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyBudgetPage } from './pages/PrivacyBudgetPage';
import { PersonasPage } from './pages/PersonasPage';
import { DeadManSwitchPage } from './pages/DeadManSwitchPage';
import { ForensicsPage } from './pages/ForensicsPage';
import { ReverseDisclosurePage } from './pages/ReverseDisclosurePage';
import { ConsentReceiptsPage } from './pages/ConsentReceiptsPage';
import { AgentReputationPage } from './pages/AgentReputationPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { AgentDemoPage } from './pages/AgentDemoPage';
import { SDKPlaygroundPage } from './pages/SDKPlaygroundPage';
import { ApprovePage } from './pages/ApprovePage';
import { AttestationsPage } from './pages/AttestationsPage';
import { StatusNetworkPage } from './pages/StatusNetworkPage';
import { ERC8128DemoPage } from './pages/ERC8128DemoPage';
import { SliceCheckoutPage } from './pages/SliceCheckoutPage';

function AppRoutes() {
  const { walletAddress, showOnboarding, setShowOnboarding } = useApp();

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  return (
    <>
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
      />
      <Routes>
      <Route path="/" element={!walletAddress ? <LandingPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="/connect" element={walletAddress ? <Navigate to="/dashboard" replace /> : <ConnectPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/scenarios" element={<ScenariosPage />} />
      <Route path="/agent-demo" element={<AgentDemoPage />} />
      <Route path="/approve" element={<ApprovePage />} />
      <Route path="/sdk" element={<SDKPlaygroundPage />} />
      <Route path="/attestations" element={<AttestationsPage />} />
      <Route path="/status-network" element={<StatusNetworkPage />} />
      <Route path="/erc8128" element={<ERC8128DemoPage />} />
      <Route path="/slice" element={<SliceCheckoutPage />} />

      {walletAddress ? (
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/vault" element={<VaultPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/budget" element={<PrivacyBudgetPage />} />
          <Route path="/personas" element={<PersonasPage />} />
          <Route path="/deadman" element={<DeadManSwitchPage />} />
          <Route path="/forensics" element={<ForensicsPage />} />
          <Route path="/reverse" element={<ReverseDisclosurePage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/receipts" element={<ConsentReceiptsPage />} />
          <Route path="/reputation" element={<AgentReputationPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/" replace />} />
      )}
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;
