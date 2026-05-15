import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const LAST_SYNCED_KEY = 'lastSyncedAt';

type SyncState = {
  syncing: boolean;
  lastSyncedAt: number | null;
  lastError: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSyncing: (v: boolean) => void;
  setLastSyncedAt: (ms: number) => Promise<void>;
  setLastError: (msg: string | null) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  syncing: false,
  lastSyncedAt: null,
  lastError: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(LAST_SYNCED_KEY);
      const ms = stored ? Number(stored) : null;
      set({ lastSyncedAt: Number.isFinite(ms ?? NaN) ? ms : null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setSyncing: (v: boolean) => set({ syncing: v }),

  setLastSyncedAt: async (ms: number) => {
    set({ lastSyncedAt: ms });
    try {
      await SecureStore.setItemAsync(LAST_SYNCED_KEY, String(ms));
    } catch {
      // best effort
    }
  },

  setLastError: (msg: string | null) => set({ lastError: msg }),
}));
