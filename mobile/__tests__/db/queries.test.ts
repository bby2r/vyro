import {
  bucketByCategory,
  runningTotalSeries,
  thisMonthWindow,
  thisWeekWindow,
  todayWindow,
  topDescriptions,
  totalCents,
  yesterdayWindow,
} from '@/src/db/queries';
import { type Expense, type Todo } from '@/src/db/schema';

import { asc, desc, isNull, sql } from 'drizzle-orm';
import { expenses, todos } from '@/src/db/schema';

import { makeTestDb } from '../testDb';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  const now = overrides.created_at ?? new Date('2026-05-10T12:00:00Z');
  return {
    client_id: overrides.client_id ?? Math.random().toString(36).slice(2),
    description: overrides.description ?? 'coffee',
    amount_cents: overrides.amount_cents ?? 350,
    currency: overrides.currency ?? 'USD',
    category: overrides.category ?? null,
    labels: overrides.labels ?? null,
    occurred_at: overrides.occurred_at ?? now,
    deleted_at: overrides.deleted_at ?? null,
    created_at: now,
    updated_at: overrides.updated_at ?? now,
    synced_at: overrides.synced_at ?? null,
  };
}

describe('time windows', () => {
  it('todayWindow returns [00:00 today, 00:00 tomorrow)', () => {
    const now = new Date('2026-05-16T15:30:00');
    const w = todayWindow(now);
    expect(w.from.getHours()).toBe(0);
    expect(w.to.getTime() - w.from.getTime()).toBe(86_400_000);
  });

  it('yesterdayWindow precedes todayWindow exactly', () => {
    const now = new Date('2026-05-16T15:30:00');
    const t = todayWindow(now);
    const y = yesterdayWindow(now);
    expect(y.to.getTime()).toBe(t.from.getTime());
    expect(t.from.getTime() - y.from.getTime()).toBe(86_400_000);
  });

  it('thisWeekWindow starts on Monday', () => {
    // 2026-05-16 is a Saturday.
    const now = new Date('2026-05-16T15:30:00');
    const w = thisWeekWindow(now);
    // Monday=1
    expect(w.from.getDay()).toBe(1);
  });

  it('thisMonthWindow covers exactly the calendar month', () => {
    const now = new Date('2026-05-16T15:30:00');
    const w = thisMonthWindow(now);
    expect(w.from.getDate()).toBe(1);
    expect(w.from.getMonth()).toBe(4); // May = 4
    expect(w.to.getMonth()).toBe(5); // June
  });
});

describe('aggregations', () => {
  it('totalCents sums correctly', () => {
    expect(totalCents([makeExpense({ amount_cents: 100 }), makeExpense({ amount_cents: 250 })])).toBe(
      350,
    );
  });

  it('bucketByCategory groups null as Uncategorized and sorts desc', () => {
    const rows = [
      makeExpense({ amount_cents: 500, category: 'Food' }),
      makeExpense({ amount_cents: 200, category: null }),
      makeExpense({ amount_cents: 300, category: 'Food' }),
      makeExpense({ amount_cents: 100, category: '' }),
    ];
    const buckets = bucketByCategory(rows);
    expect(buckets).toEqual([
      { category: 'Food', cents: 800 },
      { category: 'Uncategorized', cents: 300 },
    ]);
  });

  it('topDescriptions returns top N by spend', () => {
    const rows = [
      makeExpense({ description: 'a', amount_cents: 100 }),
      makeExpense({ description: 'a', amount_cents: 200 }),
      makeExpense({ description: 'b', amount_cents: 500 }),
      makeExpense({ description: 'c', amount_cents: 50 }),
    ];
    const top = topDescriptions(rows, 2);
    expect(top).toEqual([
      { description: 'b', cents: 500 },
      { description: 'a', cents: 300 },
    ]);
  });

  it('runningTotalSeries produces hourly buckets for 24h window', () => {
    const w = todayWindow(new Date('2026-05-16T15:00:00'));
    const expense = makeExpense({
      amount_cents: 500,
      occurred_at: new Date(w.from.getTime() + 3 * 3600_000), // 03:00
    });
    const series = runningTotalSeries([expense], w);
    expect(series).toHaveLength(24);
    expect(series[2].cents).toBe(0);
    expect(series[3].cents).toBe(500);
    expect(series[23].cents).toBe(500);
  });

  it('runningTotalSeries produces daily buckets for a month', () => {
    const w = thisMonthWindow(new Date('2026-05-16T00:00:00'));
    const expense = makeExpense({
      amount_cents: 1000,
      occurred_at: new Date(w.from.getTime() + 4 * 86_400_000),
    });
    const series = runningTotalSeries([expense], w);
    expect(series.length).toBeGreaterThanOrEqual(28);
    expect(series[3].cents).toBe(0);
    expect(series[4].cents).toBe(1000);
  });
});

describe('todo list ordering (raw drizzle)', () => {
  // We rebuild listTodos against the in-memory test DB so we exercise the actual
  // ORDER BY chain that production uses.
  function listTodosWith(db: ReturnType<typeof makeTestDb>) {
    return db
      .select()
      .from(todos)
      .where(isNull(todos.deleted_at))
      .orderBy(
        asc(todos.done),
        sql`CASE WHEN ${todos.due_at} IS NULL THEN 1 ELSE 0 END`,
        asc(todos.due_at),
        desc(todos.created_at),
      )
      .all();
  }

  function makeTodo(overrides: Partial<Todo> = {}): Todo {
    const now = overrides.created_at ?? new Date('2026-05-10T12:00:00Z');
    return {
      client_id: overrides.client_id ?? Math.random().toString(36).slice(2),
      title: overrides.title ?? 't',
      due_at: overrides.due_at ?? null,
      done: overrides.done ?? 0,
      category: overrides.category ?? null,
      labels: overrides.labels ?? null,
      estimated_minutes: overrides.estimated_minutes ?? null,
      notification_id: overrides.notification_id ?? null,
      deleted_at: overrides.deleted_at ?? null,
      created_at: now,
      updated_at: overrides.updated_at ?? now,
      synced_at: overrides.synced_at ?? null,
    };
  }

  it('orders done last, then due_at ASC with NULLs LAST, then created_at DESC', () => {
    const db = makeTestDb();
    const baseDate = new Date('2026-05-10T12:00:00');
    const t1 = makeTodo({
      client_id: '1',
      done: 0,
      due_at: new Date(baseDate.getTime() + 86_400_000), // tomorrow
      created_at: new Date(baseDate.getTime() - 3600_000),
    });
    const t2 = makeTodo({
      client_id: '2',
      done: 0,
      due_at: null,
      created_at: new Date(baseDate.getTime() - 1800_000),
    });
    const t3 = makeTodo({
      client_id: '3',
      done: 1,
      due_at: new Date(baseDate.getTime() + 2 * 86_400_000),
      created_at: baseDate,
    });
    const t4 = makeTodo({
      client_id: '4',
      done: 0,
      due_at: new Date(baseDate.getTime() + 3600_000),
      created_at: baseDate,
    });

    db.insert(todos).values([t1, t2, t3, t4]).run();

    const sorted = listTodosWith(db);
    // Order: t4 (due soonest), t1 (due later), t2 (no due, undone), then t3 (done last)
    expect(sorted.map((r) => r.client_id)).toEqual(['4', '1', '2', '3']);
  });

  it('excludes soft-deleted rows', () => {
    const db = makeTestDb();
    const now = new Date('2026-05-10T12:00:00');
    db.insert(todos)
      .values([
        makeTodo({ client_id: 'live', deleted_at: null }),
        makeTodo({ client_id: 'dead', deleted_at: now }),
      ])
      .run();
    const out = listTodosWith(db);
    expect(out.map((r) => r.client_id)).toEqual(['live']);
  });
});
