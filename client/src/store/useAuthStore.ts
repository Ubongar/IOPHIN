import { create } from 'zustand';
import type { User, Permission, Role } from '../types';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  permissions: Permission[];
  roles: Role[];
  profileLoading: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setPermissions: (permissions: Permission[]) => void;
  setRoles: (roles: Role[]) => void;
  login: (user: User, token: string, permissions?: Permission[]) => void;
  logout: () => void;
  hasPermission: (permissionName: string) => boolean;
  hasRole: (roleName: string) => boolean;
  isSuperAdmin: () => boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { fullName?: string; organization?: string; currentPassword?: string; newPassword?: string }) => Promise<{ success: boolean; error?: string }>;
  promoteSuperAdmin: () => Promise<{ success: boolean; error?: string; message?: string }>;
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
    profileLoading: false,
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
    login: (user, token, permissions) => {
      try { window.localStorage.setItem('iophin_token', token); } catch { /* ignore */ }
      set({ user, token, isAuthenticated: true, permissions: permissions || [] });
    },
    logout: () => {
      try { window.localStorage.removeItem('iophin_token'); } catch { /* ignore */ }
      set({ user: null, token: null, isAuthenticated: false, permissions: [], roles: [] });
    },
    hasPermission: (permissionName: string) => {
      const { permissions, user } = get();
      // Super admins have all permissions
      if (user?.role === 'super_admin') return true;
      return permissions.some(p => p.name === permissionName);
    },
    hasRole: (roleName: string) => {
      const { user } = get();
      return user?.role === roleName;
    },
    isSuperAdmin: () => {
      const { user } = get();
      return user?.role === 'super_admin';
    },
    fetchProfile: async () => {
      const { token } = get();
      if (!token) return;
      set({ profileLoading: true });
      try {
        const res = await fetch(`${API}/v1/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
          if (res.status === 401) {
            // Token expired or invalid
            try { window.localStorage.removeItem('iophin_token'); } catch { /* ignore */ }
            set({ user: null, token: null, isAuthenticated: false, permissions: [], roles: [], profileLoading: false });
          }
          return;
        }
        const data = await res.json();
        const user: User = {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role_name || 'user',
          organization: data.organization
        };
        set({ 
          user, 
          isAuthenticated: true,
          permissions: data.permissions || [],
          profileLoading: false 
        });
      } catch {
        set({ profileLoading: false });
      }
    },
    updateProfile: async (data) => {
      const { token } = get();
      if (!token) return { success: false, error: 'Not authenticated' };
      try {
        const res = await fetch(`${API}/v1/me`, {
          method: 'PUT',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (!res.ok) return { success: false, error: result.error || 'Update failed' };
        
        const user: User = {
          id: result.id,
          email: result.email,
          full_name: result.full_name,
          role: result.role_name || 'user',
          organization: result.organization
        };
        set({ user, permissions: result.permissions || [] });
        return { success: true };
      } catch (err) {
        return { success: false, error: 'Network error' };
      }
    },
    promoteSuperAdmin: async () => {
      const { token } = get();
      if (!token) return { success: false, error: 'Not authenticated' };
      try {
        const res = await fetch(`${API}/v1/me/make-super-admin`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (!res.ok) return { success: false, error: result.error || 'Promotion failed' };
        
        const user: User = {
          id: result.id,
          email: result.email,
          full_name: result.full_name,
          role: result.role_name || 'super_admin',
          organization: result.organization
        };
        set({ user, permissions: result.permissions || [] });
        return { success: true, message: result.message };
      } catch (err) {
        return { success: false, error: 'Network error' };
      }
    },
  };
});
