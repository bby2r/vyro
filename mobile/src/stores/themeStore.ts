import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import type { ThemeMode } from '../theme/tokens';

const STORAGE_KEY = 'themeMode';

type ThemeState = {
  mode: ThemeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggle: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        set({ mode: stored, hydrated: true });
        return;
      }
    } catch {
      // SecureStore unavailable (e.g. web); fall back to default.
    }
    set({ hydrated: true });
  },

  toggle: async () => {
    const next: ThemeMode = get().mode === 'dark' ? 'light' : 'dark';
    set({ mode: next });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, next);
    } catch {
      // Best-effort persistence.
    }
  },

  setMode: async (mode: ThemeMode) => {
    set({ mode });
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, mode);
    } catch {
      // Best-effort persistence.
    }
  },
}));
