import type { PropsWithChildren } from 'react';
import { AppHeader, type View } from './AppHeader';

interface AppLayoutProps extends PropsWithChildren {
  activeView: View;
  onChangeView: (view: View) => void;
}

export function AppLayout({ activeView, onChangeView, children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <AppHeader activeView={activeView} onChangeView={onChangeView} />
      <main className="page-container">{children}</main>
    </div>
  );
}
