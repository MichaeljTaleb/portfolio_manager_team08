import { useState } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import type { View } from './components/layout/AppHeader';
import { LivePricesProvider } from './contexts/LivePricesContext';
import { UserProvider } from './contexts/UserContext';
import { CashPage } from './pages/CashPage';
import { DashboardPage } from './pages/DashboardPage';
import { HoldingsPage } from './pages/HoldingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { StockDetailPage } from './pages/StockDetailPage';
import type { Holding } from './types/portfolio';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  const handleChangeView = (nextView: View) => {
    setSelectedHolding(null);
    setView(nextView);
  };

  return (
    <UserProvider>
      <LivePricesProvider>
        <AppLayout activeView={view} onChangeView={handleChangeView}>
          {selectedHolding ? (
            <StockDetailPage holding={selectedHolding} onBack={() => setSelectedHolding(null)} />
          ) : (
            <>
              {view === 'dashboard' && (
                <DashboardPage onViewHoldings={() => setView('holdings')} onSelectStock={setSelectedHolding} />
              )}
              {view === 'holdings' && <HoldingsPage onSelectStock={setSelectedHolding} />}
              {view === 'cash' && <CashPage />}
              {view === 'profile' && <ProfilePage />}
            </>
          )}
        </AppLayout>
      </LivePricesProvider>
    </UserProvider>
  );
}
