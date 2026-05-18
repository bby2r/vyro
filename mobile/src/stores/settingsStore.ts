import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export const SUPPORTED_CURRENCIES = ['KGS', 'USD', 'CNY'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const CURRENCY_KEY = 'defaultCurrency';

type SettingsState = {
  defaultCurrency: Currency;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDefaultCurrency: (c: Currency) => Promise<void>;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  defaultCurrency: 'KGS',
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(CURRENCY_KEY);
      if (stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored)) {
        set({ defaultCurrency: stored as Currency, hydrated: true });
        return;
      }
    } catch {
      // SecureStore unavailable; fall back to default.
    }
    set({ hydrated: true });
  },

  setDefaultCurrency: async (c: Currency) => {
    set({ defaultCurrency: c });
    try {
      await SecureStore.setItemAsync(CURRENCY_KEY, c);
    } catch {
      // best-effort persistence
    }
  },
}));
