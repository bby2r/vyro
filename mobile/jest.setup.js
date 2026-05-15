// Jest setup — bridges native modules to lightweight mocks.
/* eslint-disable @typescript-eslint/no-require-imports */

// Ensure __DEV__ exists for source files that gate on it.
if (typeof global.__DEV__ === 'undefined') {
  global.__DEV__ = true;
}

jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: jest.fn(async (k) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k, v) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k) => {
      store.delete(k);
    }),
    __reset: () => store.clear(),
  };
});

jest.mock('expo-crypto', () => {
  let counter = 0;
  const pad = (n) => String(n).padStart(12, '0');
  return {
    randomUUID: jest.fn(() => {
      counter += 1;
      return `00000000-0000-4000-8000-${pad(counter)}`;
    }),
  };
});

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => 'mock-notification-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  IosAuthorizationStatus: { PROVISIONAL: 'provisional' },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execAsync: jest.fn(async () => undefined),
  })),
}));

// Drizzle's expo adapter expects a native module surface we don't have in jest.
// Tests import their own db handle via @/src/db/testdb.
