import { create } from 'zustand';

interface AlertNotification {
  id: string;
  type: string;
  message: string;
  severity: string;
  timestamp: string;
  lga_name?: string;
  state?: string;
}

interface AlertState {
  notifications: AlertNotification[];
  unreadCount: number;
  addNotification: (n: AlertNotification) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    })),
  markAllRead: () => set({ unreadCount: 0 }),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
