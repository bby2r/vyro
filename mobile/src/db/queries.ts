import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import { db } from './index';
import { expenses, todos, type Expense, type Todo } from './schema';

/**
 * Read helpers. Kept thin — most screens call these directly inside useEffect/
 * useFocusEffect and re-fetch on local mutation.
 */

export async function listExpenses(): Promise<Expense[]> {
  return db
    .select()
    .from(expenses)
    .where(isNull(expenses.deleted_at))
    .orderBy(desc(expenses.created_at));
}

export async function listExpensesSince(since: Date): Promise<Expense[]> {
  return db
    .select()
    .from(expenses)
    .where(and(isNull(expenses.deleted_at), gte(expenses.occurred_at, since)))
    .orderBy(asc(expenses.occurred_at));
}

export async function listExpensesInWindow(from: Date, to: Date): Promise<Expense[]> {
  return db
    .select()
    .from(expenses)
    .where(
      and(
        isNull(expenses.deleted_at),
        gte(expenses.occurred_at, from),
        sql`${expenses.occurred_at} < ${to}`,
      ),
    )
    .orderBy(asc(expenses.occurred_at));
}

export async function listTodos(): Promise<Todo[]> {
  // done ASC, due_at ASC NULLS LAST, created_at DESC
  return db
    .select()
    .from(todos)
    .where(isNull(todos.deleted_at))
    .orderBy(
      asc(todos.done),
      sql`CASE WHEN ${todos.due_at} IS NULL THEN 1 ELSE 0 END`,
      asc(todos.due_at),
      desc(todos.created_at),
    );
}

export async function getExpense(clientId: string): Promise<Expense | undefined> {
  const rows = await db.select().from(expenses).where(eq(expenses.client_id, clientId)).limit(1);
  return rows[0];
}

export async function getTodo(clientId: string): Promise<Todo | undefined> {
  const rows = await db.select().from(todos).where(eq(todos.client_id, clientId)).limit(1);
  return rows[0];
}

// ---- Time-window utilities (pure functions, exported for testing) ----

export type Window = { from: Date; to: Date };

export function todayWindow(now: Date = new Date()): Window {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export function yesterdayWindow(now: Date = new Date()): Window {
  const today = todayWindow(now);
  const from = new Date(today.from);
  from.setDate(from.getDate() - 1);
  const to = new Date(today.from);
  return { from, to };
}

export function thisWeekWindow(now: Date = new Date()): Window {
  // Week starts Monday (ISO style).
  const today = todayWindow(now);
  const from = new Date(today.from);
  const dayOfWeek = (from.getDay() + 6) % 7; // Monday=0..Sunday=6
  from.setDate(from.getDate() - dayOfWeek);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  return { from, to };
}

export function thisMonthWindow(now: Date = new Date()): Window {
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { from, to };
}

export type CategoryBucket = { category: string; cents: number };
export type DescriptionBucket = { description: string; cents: number };
export type SeriesPoint = { label: string; cents: number };

export function totalCents(rows: Expense[]): number {
  return rows.reduce((sum, r) => sum + r.amount_cents, 0);
}

export function bucketByCategory(rows: Expense[]): CategoryBucket[] {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = r.category && r.category.length > 0 ? r.category : 'Uncategorized';
    buckets.set(key, (buckets.get(key) ?? 0) + r.amount_cents);
  }
  return [...buckets.entries()]
    .map(([category, cents]) => ({ category, cents }))
    .sort((a, b) => b.cents - a.cents);
}

export function topDescriptions(rows: Expense[], limit: number = 5): DescriptionBucket[] {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const key = r.description.trim() || '(unlabeled)';
    buckets.set(key, (buckets.get(key) ?? 0) + r.amount_cents);
  }
  return [...buckets.entries()]
    .map(([description, cents]) => ({ description, cents }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, limit);
}

/**
 * Running total series. For windows ≤ 48h, granularity is hours; otherwise days.
 */
export function runningTotalSeries(rows: Expense[], window: Window): SeriesPoint[] {
  const spanMs = window.to.getTime() - window.from.getTime();
  const hours = Math.round(spanMs / (60 * 60 * 1000));
  const granularity: 'hour' | 'day' = hours <= 48 ? 'hour' : 'day';

  const buckets: SeriesPoint[] = [];
  if (granularity === 'hour') {
    for (let i = 0; i < hours; i++) {
      const slot = new Date(window.from.getTime() + i * 3600_000);
      buckets.push({ label: String(slot.getHours()).padStart(2, '0'), cents: 0 });
    }
  } else {
    const days = Math.ceil(spanMs / (24 * 60 * 60 * 1000));
    for (let i = 0; i < days; i++) {
      const slot = new Date(window.from.getTime() + i * 86_400_000);
      buckets.push({
        label: `${String(slot.getMonth() + 1).padStart(2, '0')}-${String(slot.getDate()).padStart(2, '0')}`,
        cents: 0,
      });
    }
  }

  for (const r of rows) {
    const tMs = r.occurred_at.getTime();
    if (tMs < window.from.getTime() || tMs >= window.to.getTime()) {
      continue;
    }
    let idx: number;
    if (granularity === 'hour') {
      idx = Math.floor((tMs - window.from.getTime()) / 3600_000);
    } else {
      idx = Math.floor((tMs - window.from.getTime()) / 86_400_000);
    }
    if (idx < 0 || idx >= buckets.length) {
      continue;
    }
    buckets[idx].cents += r.amount_cents;
  }

  // Convert to running total.
  let running = 0;
  return buckets.map((b) => {
    running += b.cents;
    return { label: b.label, cents: running };
  });
}
