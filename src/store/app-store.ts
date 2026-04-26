import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RouteName = 'dashboard' | 'global' | 'project' | 'catalog';

export interface Route {
  name: RouteName;
  screen?: string;
  id?: string;
  cmd?: string;
}

export type ToastTone = 'info' | 'success' | 'error';

export interface AppState {
  route: Route;
  settingsView: 'form' | 'json';
  catalogSelected: string;
  catalogCategory: string;
  catalogQuery: string;
  activeProject: string;
  activeInnerId: string;
  toast: string | null;
  toastTone: ToastTone;

  go: (route: Route) => void;
  set: (patch: Partial<AppState>) => void;
  toast_msg: (msg: string, tone?: ToastTone) => void;
  reset: () => void;
}

const DEFAULT: Omit<AppState, 'go' | 'set' | 'toast_msg' | 'reset'> = {
  route: { name: 'dashboard' },
  settingsView: 'form',
  catalogSelected: '/compact',
  catalogCategory: 'all',
  catalogQuery: '',
  activeProject: 'aurora',
  activeInnerId: 'overview',
  toast: null,
  toastTone: 'info',
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>()(
  persist(
    (set_state, _get) => ({
      ...DEFAULT,

      go: (route) => set_state({ route }),

      set: (patch) => set_state(patch as Partial<AppState>),

      toast_msg: (msg, tone = 'info') => {
        set_state({ toast: msg, toastTone: tone });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set_state({ toast: null }), 2600);
      },

      reset: () => {
        if (toastTimer) clearTimeout(toastTimer);
        set_state({ ...DEFAULT });
      },
    }),
    {
      name: 'ccm-state-v1',
      partialize: (s) => ({
        route: s.route,
        catalogCategory: s.catalogCategory,
        activeProject: s.activeProject,
        settingsView: s.settingsView,
      }),
    }
  )
);
