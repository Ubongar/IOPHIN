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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('iophin_token'),
  isAuthenticated: !!localStorage.getItem('iophin_token'),
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => {
    if (token) localStorage.setItem('iophin_token', token);
    else localStorage.removeItem('iophin_token');
    set({ token });
  },
  login: (user, token) => {
    localStorage.setItem('iophin_token', token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('iophin_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
