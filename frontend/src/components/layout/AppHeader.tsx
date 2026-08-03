import { getInitials, useUser } from '../../contexts/UserContext';

export type View = 'dashboard' | 'holdings' | 'cash' | 'quant-advisor' | 'profile';

interface AppHeaderProps {
  activeView: View;
  onChangeView: (view: View) => void;
}

const navItems: { view: View; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'holdings', label: 'Holdings' },
  { view: 'cash', label: 'Cash & Activity' },
  { view: 'quant-advisor', label: 'Analytics & Advisor' },
];

export function AppHeader({ activeView, onChangeView }: AppHeaderProps) {
  const { profile } = useUser();

  return (
    <>
      <header className="app-header">
        <button className="brand" type="button" onClick={() => onChangeView('dashboard')} aria-label="Go to dashboard">
          <img src="/logo.svg" alt="Vantage" className="brand-logo" />
        </button>

        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map(({ view, label }) => (
            <button
              key={view}
              type="button"
              className="nav-link"
              aria-current={activeView === view ? 'page' : undefined}
              onClick={() => onChangeView(view)}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="avatar"
          aria-label="Edit profile"
          aria-current={activeView === 'profile' ? 'page' : undefined}
          onClick={() => onChangeView('profile')}
        >
          {getInitials(profile.name)}
        </button>
      </header>
      <div className="header-rule" />
    </>
  );
}
