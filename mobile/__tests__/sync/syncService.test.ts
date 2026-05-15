import { eq, isNull } from 'drizzle-orm';

import { expenses, todos } from '@/src/db/schema';

import { makeTestDb, type TestDb } from '../testDb';

// Use a single shared mock DB so production imports of @/src/db return the same handle.
let mockDb: TestDb;
jest.mock('@/src/db', () => ({
  get db() {
    return mockDb;
  },
  runMigrations: jest.fn(async () => undefined),
}));

// Tenant store needs a uuid + backend URL for runOnce to fire.
jest.mock('@/src/stores/tenantStore', () => {
  const state = { uuid: 'tenant-abc', backendUrl: 'http://example.test' };
  return {
    useTenantStore: { getState: () => state },
  };
});

// Sync store tracks lastSyncedAt + flags.
jest.mock('@/src/stores/syncStore', () => {
  const state: {
    syncing: boolean;
    lastSyncedAt: number | null;
    lastError: string | null;
    setSyncing: (v: boolean) => void;
    setLastSyncedAt: (ms: number) => Promise<void>;
    setLastError: (msg: string | null) => void;
  } = {
    syncing: false,
    lastSyncedAt: null,
    lastError: null,
    setSyncing(v) {
      this.syncing = v;
    },
    async setLastSyncedAt(ms) {
      this.lastSyncedAt = ms;
    },
    setLastError(msg) {
      this.lastError = msg;
    },
  };
  return {
    useSyncStore: { getState: () => state },
  };
});

// Stub apiRequest so we control responses. The mock factory holds the fn so it
// runs at module-eval time (hoisted by jest); we expose it via the module export.
jest.mock('@/src/api/client', () => {
  const apiRequest = jest.fn();
  return {
    apiRequest,
    HttpError: class extends Error {},
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sync = require('@/src/sync/syncService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiClient = require('@/src/api/client') as { apiRequest: jest.Mock };
const apiRequestMock = apiClient.apiRequest;

beforeEach(() => {
  mockDb = makeTestDb();
  apiRequestMock.mockReset();
});

describe('pushUnsynced', () => {
  it('skips when nothing pending', async () => {
    await sync.pushUnsynced();
    expect(apiRequestMock).not.toHaveBeenCalled();
  });

  it('sends unsynced rows and marks them synced on response', async () => {
    const now = new Date('2026-05-16T10:00:00Z');
    mockDb
      .insert(expenses)
      .values({
        client_id: 'e1',
        description: 'coffee',
        amount_cents: 350,
        currency: 'USD',
        category: null,
        labels: null,
        occurred_at: now,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
      .run();

    apiRequestMock.mockResolvedValueOnce({
      expenses: [
        {
          client_id: 'e1',
          description: 'coffee',
          amount_cents: 350,
          currency: 'USD',
          category: null,
          labels: null,
          occurred_at: now.toISOString(),
          deleted_at: null,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
      ],
      todos: [],
    });

    await sync.pushUnsynced();

    expect(apiRequestMock).toHaveBeenCalledWith('/sync/push', expect.objectContaining({
      method: 'POST',
    }));

    const remaining = mockDb.select().from(expenses).where(isNull(expenses.synced_at)).all();
    expect(remaining).toHaveLength(0);

    const synced = mockDb.select().from(expenses).where(eq(expenses.client_id, 'e1')).all();
    expect(synced[0].synced_at).toBeTruthy();
  });
});

describe('pullSince', () => {
  it('inserts new server rows', async () => {
    apiRequestMock.mockResolvedValueOnce({
      server_time: '2026-05-16T10:00:00Z',
      expenses: [
        {
          client_id: 'remote-1',
          description: 'lunch',
          amount_cents: 1500,
          currency: 'USD',
          category: 'Food',
          labels: ['restaurant'],
          occurred_at: '2026-05-16T09:00:00Z',
          deleted_at: null,
          created_at: '2026-05-16T09:00:00Z',
          updated_at: '2026-05-16T09:00:00Z',
        },
      ],
      todos: [],
    });

    await sync.pullSince(null);

    const rows = mockDb.select().from(expenses).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe('remote-1');
    expect(rows[0].category).toBe('Food');
    expect(rows[0].labels).toBe(JSON.stringify(['restaurant']));
    expect(rows[0].synced_at).toBeTruthy();
  });

  it('applies tombstones (sets deleted_at locally)', async () => {
    const now = new Date('2026-05-16T08:00:00Z');
    mockDb
      .insert(expenses)
      .values({
        client_id: 'e-soft',
        description: 'snack',
        amount_cents: 200,
        currency: 'USD',
        category: null,
        labels: null,
        occurred_at: now,
        deleted_at: null,
        created_at: now,
        updated_at: now,
        synced_at: now,
      })
      .run();

    apiRequestMock.mockResolvedValueOnce({
      server_time: '2026-05-16T10:00:00Z',
      expenses: [
        {
          client_id: 'e-soft',
          description: 'snack',
          amount_cents: 200,
          currency: 'USD',
          category: null,
          labels: null,
          occurred_at: '2026-05-16T08:00:00Z',
          deleted_at: '2026-05-16T09:00:00Z',
          created_at: '2026-05-16T08:00:00Z',
          updated_at: '2026-05-16T09:00:00Z',
        },
      ],
      todos: [],
    });

    await sync.pullSince(null);

    const row = mockDb.select().from(expenses).where(eq(expenses.client_id, 'e-soft')).get();
    expect(row?.deleted_at).toBeInstanceOf(Date);
  });

  it('last-writer-wins: skips when local is newer than server', async () => {
    const olderServer = new Date('2026-05-16T09:00:00Z');
    const newerLocal = new Date('2026-05-16T11:00:00Z');

    mockDb
      .insert(expenses)
      .values({
        client_id: 'lww-1',
        description: 'local-wins',
        amount_cents: 999,
        currency: 'USD',
        category: null,
        labels: null,
        occurred_at: newerLocal,
        deleted_at: null,
        created_at: newerLocal,
        updated_at: newerLocal,
        synced_at: null,
      })
      .run();

    apiRequestMock.mockResolvedValueOnce({
      server_time: '2026-05-16T12:00:00Z',
      expenses: [
        {
          client_id: 'lww-1',
          description: 'server-stale',
          amount_cents: 1,
          currency: 'USD',
          category: null,
          labels: null,
          occurred_at: olderServer.toISOString(),
          deleted_at: null,
          created_at: olderServer.toISOString(),
          updated_at: olderServer.toISOString(),
        },
      ],
      todos: [],
    });

    await sync.pullSince(null);

    const row = mockDb.select().from(expenses).where(eq(expenses.client_id, 'lww-1')).get();
    expect(row?.description).toBe('local-wins');
    expect(row?.amount_cents).toBe(999);
  });

  it('last-writer-wins: overwrites when server is newer', async () => {
    const olderLocal = new Date('2026-05-16T09:00:00Z');
    const newerServer = new Date('2026-05-16T11:00:00Z');

    mockDb
      .insert(expenses)
      .values({
        client_id: 'lww-2',
        description: 'local-stale',
        amount_cents: 1,
        currency: 'USD',
        category: null,
        labels: null,
        occurred_at: olderLocal,
        deleted_at: null,
        created_at: olderLocal,
        updated_at: olderLocal,
        synced_at: olderLocal,
      })
      .run();

    apiRequestMock.mockResolvedValueOnce({
      server_time: '2026-05-16T12:00:00Z',
      expenses: [
        {
          client_id: 'lww-2',
          description: 'server-wins',
          amount_cents: 999,
          currency: 'USD',
          category: 'Food',
          labels: null,
          occurred_at: newerServer.toISOString(),
          deleted_at: null,
          created_at: newerServer.toISOString(),
          updated_at: newerServer.toISOString(),
        },
      ],
      todos: [],
    });

    await sync.pullSince(null);

    const row = mockDb.select().from(expenses).where(eq(expenses.client_id, 'lww-2')).get();
    expect(row?.description).toBe('server-wins');
    expect(row?.amount_cents).toBe(999);
    expect(row?.category).toBe('Food');
  });

  it('upserts todos similarly', async () => {
    apiRequestMock.mockResolvedValueOnce({
      server_time: '2026-05-16T10:00:00Z',
      expenses: [],
      todos: [
        {
          client_id: 'todo-1',
          title: 'pay bills',
          due_at: '2026-05-20T09:00:00Z',
          done: false,
          category: null,
          labels: null,
          estimated_minutes: null,
          deleted_at: null,
          created_at: '2026-05-16T09:00:00Z',
          updated_at: '2026-05-16T09:00:00Z',
        },
      ],
    });

    await sync.pullSince(null);

    const row = mockDb.select().from(todos).where(eq(todos.client_id, 'todo-1')).get();
    expect(row?.title).toBe('pay bills');
    expect(row?.done).toBe(0);
    expect(row?.due_at).toBeInstanceOf(Date);
  });
});

describe('helpers', () => {
  it('serializeLabels returns null for empty', () => {
    expect(sync.__internal.serializeLabels(null)).toBeNull();
    expect(sync.__internal.serializeLabels([])).toBeNull();
    expect(sync.__internal.serializeLabels(['a'])).toBe(JSON.stringify(['a']));
  });

  it('parseLabels survives bad input', () => {
    expect(sync.__internal.parseLabels(null)).toBeNull();
    expect(sync.__internal.parseLabels('{not-json')).toBeNull();
    expect(sync.__internal.parseLabels(JSON.stringify(['x']))).toEqual(['x']);
  });
});
