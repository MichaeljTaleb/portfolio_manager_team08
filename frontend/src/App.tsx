import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import type { View } from './components/layout/AppHeader';
import { LivePricesProvider } from './contexts/LivePricesContext';
import { DashboardPage } from './pages/DashboardPage';
import { HoldingsPage } from './pages/HoldingsPage';

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <LivePricesProvider>
      <AppLayout activeView={view} onChangeView={setView}>
        {view === 'dashboard' && <DashboardPage onViewHoldings={() => setView('holdings')} />}
        {view === 'holdings' && <HoldingsPage />}
      </AppLayout>
    </LivePricesProvider>
  );
}
