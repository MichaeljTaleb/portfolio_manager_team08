import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface UserProfile {
  name: string;
  email: string;
}

interface UserContextValue {
  profile: UserProfile;
  updateProfile: (profile: UserProfile) => void;
}

const STORAGE_KEY = 'vantage-user-profile';

const defaultProfile: UserProfile = {
  name: 'Sang Smith',
  email: '',
};

const loadStoredProfile = (): UserProfile => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProfile;
    const parsed = JSON.parse(raw);
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : defaultProfile.name,
      email: typeof parsed.email === 'string' ? parsed.email : '',
    };
  } catch {
    return defaultProfile;
  }
};

export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getFirstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(loadStoredProfile);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }, [profile]);

  return (
    <UserContext.Provider value={{ profile, updateProfile: setProfile }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
}
