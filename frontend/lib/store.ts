import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Notification } from './types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  setNotifications: (notifs: Notification[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

type StoreState = AuthState & NotificationState & UIState;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
          localStorage.setItem('auth_user', JSON.stringify(user));
        }
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Notifications
      notifications: [],
      unreadCount: 0,
      setNotifications: (notifs) => set({
        notifications: notifs,
        unreadCount: notifs.filter(n => n.status === 'unread').length,
      }),
      markRead: (id) => set(state => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, status: 'read' as const } : n),
        unreadCount: Math.max(0, state.unreadCount - 1),
      })),
      markAllRead: () => set(state => ({
        notifications: state.notifications.map(n => ({ ...n, status: 'read' as const })),
        unreadCount: 0,
      })),

      // UI
      sidebarCollapsed: false,
      toggleSidebar: () => set(state => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'goal-portal-store',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
