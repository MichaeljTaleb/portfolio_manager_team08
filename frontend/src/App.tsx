import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import type { View } from './components/layout/AppHeader';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HoldingsPage } from './pages/HoldingsPage';

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  return (
    <AppLayout activeView={view} onChangeView={setView}>
      {view === 'dashboard' && <DashboardPage onViewHoldings={() => setView('holdings')} />}
      {view === 'holdings' && <HoldingsPage />}
      {view === 'analytics' && <AnalyticsPage />}
    </AppLayout>
  );
}
