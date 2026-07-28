export type View = 'dashboard' | 'holdings' | 'analytics';

interface AppHeaderProps {
  activeView: View;
  onChangeView: (view: View) => void;
}

export function AppHeader({ activeView, onChangeView }: AppHeaderProps) {
  return (
    <>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => onChangeView('dashboard')} aria-label="Go to dashboard">
          <img src="/logo.svg" alt="Vantage" className="brand-logo" />
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {(['dashboard', 'holdings', 'analytics'] as const).map((view) => (
            <button
              key={view}
              type="button"
              className="nav-link"
              aria-current={activeView === view ? 'page' : undefined}
              onClick={() => onChangeView(view)}
            >
              {view[0].toUpperCase() + view.slice(1)}
            </button>
          ))}
        </nav>

        <div className="avatar" aria-label="User profile">SS</div>
      </header>
      <div className="header-rule" />
    </>
  );
}
