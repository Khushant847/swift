import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { AdminUser, LoginResponse } from './types';

const INACTIVITY_MINUTES = 15;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;

interface AuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  verifyMfa: (challengeId: string, code: string) => Promise<void>;
  logout: (reason?: string) => Promise<void>;
  refresh: () => Promise<void>;
  sessionNotice: string | null;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<AdminUser>('/admin/auth/me');
      setAdmin(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Reset local session state without hitting the network. */
  const resetSession = useCallback(
    (reason?: string) => {
      if (timer.current) clearTimeout(timer.current);
      // Drop cached queries so the next admin never sees the previous
      // session's data flashed from the cache.
      queryClient.clear();
      setAdmin(null);
      if (reason) setSessionNotice(reason);
    },
    [queryClient],
  );

  const logout = useCallback(
    async (reason?: string) => {
      try {
        await api.post('/admin/auth/logout');
      } catch {
        /* ignore */
      }
      resetSession(reason);
    },
    [resetSession],
  );

  // Any 401 from any request means the JWT expired (20 min) or was revoked —
  // without this the SPA stayed "logged in" on a dead session.
  useEffect(() => {
    const onUnauthorized = () => {
      setAdmin((current) => {
        if (current) resetSession('Your session expired. Please sign in again.');
        return null;
      });
    };
    window.addEventListener('swift:unauthorized', onUnauthorized);
    return () => window.removeEventListener('swift:unauthorized', onUnauthorized);
  }, [resetSession]);

  // ── Session inactivity auto-logout ─────────────────────────
  useEffect(() => {
    if (!admin) return;
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void logout('You were signed out automatically after 15 minutes of inactivity.');
      }, INACTIVITY_MINUTES * 60 * 1000);
    };
    reset();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, reset, { passive: true });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, reset);
    };
  }, [admin, logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>('/admin/auth/login', { email, password });
    if (res.admin) setAdmin(res.admin);
    return res;
  }, []);

  const verifyMfa = useCallback(async (challengeId: string, code: string) => {
    const res = await api.post<{ admin: AdminUser }>('/admin/auth/mfa/verify', { challengeId, code });
    setAdmin(res.admin);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        login,
        verifyMfa,
        logout,
        refresh,
        sessionNotice,
        clearNotice: () => setSessionNotice(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
