import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const UUID_KEY = 'tenantUuid';
const URL_KEY = 'backendUrl';

type TenantState = {
  uuid: string | null;
  backendUrl: string | null;
  hydrated: boolean;
  bootstrap: () => Promise<void>;
  setUuid: (newUuid: string) => Promise<void>;
  setBackendUrl: (url: string) => Promise<void>;
};

export const useTenantStore = create<TenantState>((set) => ({
  uuid: null,
  backendUrl: null,
  hydrated: false,

  bootstrap: async () => {
    let uuid: string | null = null;
    let backendUrl: string | null = null;

    try {
      uuid = await SecureStore.getItemAsync(UUID_KEY);
      backendUrl = await SecureStore.getItemAsync(URL_KEY);
    } catch {
      // SecureStore may be unavailable on some platforms; treat as fresh.
    }

    if (!uuid) {
      uuid = Crypto.randomUUID();
      try {
        await SecureStore.setItemAsync(UUID_KEY, uuid);
      } catch {
        // Best-effort persistence.
      }
    }

    set({ uuid, backendUrl, hydrated: true });
  },

  setUuid: async (newUuid: string) => {
    set({ uuid: newUuid });
    try {
      await SecureStore.setItemAsync(UUID_KEY, newUuid);
    } catch {
      // Best-effort persistence.
    }
  },

  setBackendUrl: async (url: string) => {
    set({ backendUrl: url });
    try {
      await SecureStore.setItemAsync(URL_KEY, url);
    } catch {
      // Best-effort persistence.
    }
  },
}));
