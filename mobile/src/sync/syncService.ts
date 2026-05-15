import { eq, isNull } from 'drizzle-orm';

import { apiRequest, HttpError } from '../api/client';
import { db } from '../db';
import { expenses, todos, type Expense, type Todo } from '../db/schema';
import { logWarn } from '../log';
import { useSyncStore } from '../stores/syncStore';
import { useTenantStore } from '../stores/tenantStore';

type WireExpense = {
  client_id: string;
  description: string;
  amount_cents: number;
  currency: string | null;
  category: string | null;
  labels: string[] | null;
  occurred_at: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type WireTodo = {
  client_id: string;
  title: string;
  due_at: string | null;
  done: boolean;
  category: string | null;
  labels: string[] | null;
  estimated_minutes: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type PushResponse = {
  expenses: WireExpense[];
  todos: WireTodo[];
};

type PullResponse = {
  server_time: string;
  expenses: WireExpense[];
  todos: WireTodo[];
};

type MeResponse = {
  uuid: string;
  label: string | null;
  last_synced_at: string | null;
};

function toIso(ts: Date | null | undefined): string | null {
  if (!ts) {
    return null;
  }
  return ts.toISOString();
}

function fromIso(iso: string | null | undefined): Date | null {
  if (!iso) {
    return null;
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function parseLabels(raw: string | null): string[] | null {
  if (!raw) {
    return null;
  }
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function serializeLabels(arr: string[] | null | undefined): string | null {
  if (!arr || arr.length === 0) {
    return null;
  }
  return JSON.stringify(arr);
}

function expenseToWire(row: Expense): WireExpense {
  return {
    client_id: row.client_id,
    description: row.description,
    amount_cents: row.amount_cents,
    currency: row.currency ?? null,
    category: row.category ?? null,
    labels: parseLabels(row.labels ?? null),
    occurred_at: row.occurred_at.toISOString(),
    deleted_at: toIso(row.deleted_at),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function todoToWire(row: Todo): WireTodo {
  return {
    client_id: row.client_id,
    title: row.title,
    due_at: toIso(row.due_at),
    done: !!row.done,
    category: row.category ?? null,
    labels: parseLabels(row.labels ?? null),
    estimated_minutes: row.estimated_minutes ?? null,
    deleted_at: toIso(row.deleted_at),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

async function applyExpense(server: WireExpense): Promise<void> {
  const serverUpdated = fromIso(server.updated_at);
  if (!serverUpdated) {
    return;
  }
  const existing = await db
    .select()
    .from(expenses)
    .where(eq(expenses.client_id, server.client_id))
    .limit(1);
  const local = existing[0];

  if (local && local.updated_at.getTime() >= serverUpdated.getTime()) {
    // Local is at least as fresh; do nothing.
    return;
  }

  const occurred = fromIso(server.occurred_at) ?? new Date();
  const created = fromIso(server.created_at) ?? new Date();
  const deleted = fromIso(server.deleted_at);

  const row = {
    client_id: server.client_id,
    description: server.description,
    amount_cents: server.amount_cents,
    currency: server.currency ?? 'USD',
    category: server.category,
    labels: serializeLabels(server.labels),
    occurred_at: occurred,
    deleted_at: deleted,
    created_at: created,
    updated_at: serverUpdated,
    synced_at: new Date(),
  };

  if (local) {
    await db.update(expenses).set(row).where(eq(expenses.client_id, server.client_id));
  } else {
    await db.insert(expenses).values(row);
  }
}

async function applyTodo(server: WireTodo): Promise<void> {
  const serverUpdated = fromIso(server.updated_at);
  if (!serverUpdated) {
    return;
  }
  const existing = await db
    .select()
    .from(todos)
    .where(eq(todos.client_id, server.client_id))
    .limit(1);
  const local = existing[0];

  if (local && local.updated_at.getTime() >= serverUpdated.getTime()) {
    return;
  }

  const due = fromIso(server.due_at);
  const created = fromIso(server.created_at) ?? new Date();
  const deleted = fromIso(server.deleted_at);

  const row = {
    client_id: server.client_id,
    title: server.title,
    due_at: due,
    done: server.done ? 1 : 0,
    category: server.category,
    labels: serializeLabels(server.labels),
    estimated_minutes: server.estimated_minutes,
    deleted_at: deleted,
    created_at: created,
    updated_at: serverUpdated,
    synced_at: new Date(),
    // notification_id is local-only; preserve existing if any.
    notification_id: local?.notification_id ?? null,
  };

  if (local) {
    await db.update(todos).set(row).where(eq(todos.client_id, server.client_id));
  } else {
    await db.insert(todos).values(row);
  }
}

export async function pushUnsynced(): Promise<void> {
  const pendingExpenses = await db.select().from(expenses).where(isNull(expenses.synced_at));
  const pendingTodos = await db.select().from(todos).where(isNull(todos.synced_at));

  if (pendingExpenses.length === 0 && pendingTodos.length === 0) {
    return;
  }

  const payload = {
    expenses: pendingExpenses.map(expenseToWire),
    todos: pendingTodos.map(todoToWire),
  };

  const response = await apiRequest<PushResponse>('/sync/push', {
    method: 'POST',
    body: payload,
  });

  const now = new Date();
  for (const row of response.expenses) {
    const updated = fromIso(row.updated_at) ?? now;
    await db
      .update(expenses)
      .set({ synced_at: now, updated_at: updated })
      .where(eq(expenses.client_id, row.client_id));
  }
  for (const row of response.todos) {
    const updated = fromIso(row.updated_at) ?? now;
    await db
      .update(todos)
      .set({ synced_at: now, updated_at: updated })
      .where(eq(todos.client_id, row.client_id));
  }
}

export async function pullSince(since: Date | null): Promise<void> {
  const sinceIso = since ? since.toISOString() : '1970-01-01T00:00:00.000Z';
  const response = await apiRequest<PullResponse>(`/sync/pull?since=${encodeURIComponent(sinceIso)}`, {
    method: 'GET',
  });

  for (const row of response.expenses) {
    await applyExpense(row);
  }
  for (const row of response.todos) {
    await applyTodo(row);
  }
}

export async function fullPull(): Promise<void> {
  await pullSince(null);
}

export async function isReachable(): Promise<boolean> {
  try {
    await apiRequest<MeResponse>('/tenant/me', {
      method: 'GET',
      timeoutMs: 2000,
    });
    return true;
  } catch {
    return false;
  }
}

let runOncePromise: Promise<void> | null = null;

export async function runOnce(): Promise<void> {
  if (runOncePromise) {
    return runOncePromise;
  }
  const { uuid, backendUrl } = useTenantStore.getState();
  if (!uuid || !backendUrl) {
    return;
  }

  const store = useSyncStore.getState();
  store.setSyncing(true);
  store.setLastError(null);

  runOncePromise = (async () => {
    try {
      await pushUnsynced();
      const since = useSyncStore.getState().lastSyncedAt;
      await pullSince(since ? new Date(since) : null);
      await useSyncStore.getState().setLastSyncedAt(Date.now());
    } catch (err) {
      const msg = err instanceof HttpError ? err.message : String(err);
      logWarn('sync runOnce failed', msg);
      useSyncStore.getState().setLastError(msg);
    } finally {
      useSyncStore.getState().setSyncing(false);
      runOncePromise = null;
    }
  })();

  return runOncePromise;
}

// Exposed for tests.
export const __internal = {
  expenseToWire,
  todoToWire,
  applyExpense,
  applyTodo,
  serializeLabels,
  parseLabels,
};
