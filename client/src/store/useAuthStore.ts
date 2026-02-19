import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
}

const getInitialToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('iophin_token');
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set) => {
  const initialToken = getInitialToken();
  return {
    user: null,
    token: initialToken,
    isAuthenticated: !!initialToken,
    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setToken: (token) => {
      try {
        if (token) window.localStorage.setItem('iophin_token', token);
        else window.localStorage.removeItem('iophin_token');
      } catch { /* SSR or storage blocked */ }
      set({ token });
    },
    login: (user, token) => {
      try { window.localStorage.setItem('iophin_token', token); } catch { /* ignore */ }
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      try { window.localStorage.removeItem('iophin_token'); } catch { /* ignore */ }
      set({ user: null, token: null, isAuthenticated: false });
    },
  };
});
