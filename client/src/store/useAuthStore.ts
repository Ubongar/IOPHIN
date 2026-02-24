import { create } from 'zustand';
import type { User, Permission, Role } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  permissions: Permission[];
  roles: Role[];
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setPermissions: (permissions: Permission[]) => void;
  setRoles: (roles: Role[]) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permissionName: string) => boolean;
  hasRole: (roleName: string) => boolean;
  isSuperAdmin: () => boolean;
}

const getInitialToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem('iophin_token');
  } catch {
    return null;
  }
};

export const useAuthStore = create<AuthState>((set, get) => {
  const initialToken = getInitialToken();

  return {
    user: null,
    token: initialToken,
    isAuthenticated: !!initialToken,
    permissions: [],
    roles: [],
    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setToken: (token) => {
      try {
        if (token) window.localStorage.setItem('iophin_token', token);
        else window.localStorage.removeItem('iophin_token');
      } catch { /* SSR or storage blocked */ }
      set({ token });
    },
    setPermissions: (permissions) => set({ permissions }),
    setRoles: (roles) => set({ roles }),
    login: (user, token) => {
      try { window.localStorage.setItem('iophin_token', token); } catch { /* ignore */ }
      set({ user, token, isAuthenticated: true });
    },
    logout: () => {
      try { window.localStorage.removeItem('iophin_token'); } catch { /* ignore */ }
      set({ user: null, token: null, isAuthenticated: false, permissions: [], roles: [] });
    },
    hasPermission: (permissionName: string) => {
      const { permissions } = get();
      return permissions.some(p => p.name === permissionName);
    },
    hasRole: (roleName: string) => {
      const { user } = get();
      return user?.role === roleName;
    },
    isSuperAdmin: () => {
      const { user } = get();
      return user?.role === 'super_admin' || user?.role === 'admin';
    },
  };
});
