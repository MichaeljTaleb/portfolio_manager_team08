import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import type { View } from './components/layout/AppHeader';
import { LivePricesProvider } from './contexts/LivePricesContext';
import { UserProvider } from './contexts/UserContext';
import { CashPage } from './pages/CashPage';
import { DashboardPage } from './pages/DashboardPage';
import { HoldingsPage } from './pages/HoldingsPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <UserProvider>
      <LivePricesProvider>
        <AppLayout activeView={view} onChangeView={setView}>
          {view === 'dashboard' && <DashboardPage onViewHoldings={() => setView('holdings')} />}
          {view === 'holdings' && <HoldingsPage />}
          {view === 'cash' && <CashPage />}
          {view === 'profile' && <ProfilePage />}
        </AppLayout>
      </LivePricesProvider>
    </UserProvider>
  );
}
