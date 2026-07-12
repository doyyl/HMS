import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, getToken } from './api';

export interface User {
  id: number;
  username: string;
  role: 'manager' | 'staff';
  displayName: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isManager: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { username, password });
    setToken(r.token);
    setUser(r.user);
  }

  function logout() {
    // Best-effort audit; the token is discarded regardless of the result.
    api.post('/auth/logout').catch(() => {});
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <Ctx.Provider value={{ user, loading, login, logout, isManager: user?.role === 'manager' }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
