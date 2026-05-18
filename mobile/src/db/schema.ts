import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Expenses table — mirrors backend schema minus tenant_id (single-tenant on device).
 * labels is JSON-encoded text. Timestamps stored as unix-ms integers.
 */
export const expenses = sqliteTable('expenses', {
  client_id: text('client_id').primaryKey(),
  description: text('description').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  currency: text('currency').default('KGS'),
  category: text('category'),
  labels: text('labels'),
  occurred_at: integer('occurred_at', { mode: 'timestamp' }).notNull(),
  deleted_at: integer('deleted_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
  synced_at: integer('synced_at', { mode: 'timestamp' }),
});

export const todos = sqliteTable('todos', {
  client_id: text('client_id').primaryKey(),
  title: text('title').notNull(),
  due_at: integer('due_at', { mode: 'timestamp' }),
  done: integer('done').notNull().default(0),
  category: text('category'),
  labels: text('labels'),
  estimated_minutes: integer('estimated_minutes'),
  notification_id: text('notification_id'),
  deleted_at: integer('deleted_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
  synced_at: integer('synced_at', { mode: 'timestamp' }),
});

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Todo = typeof todos.$inferSelect;
export type NewTodo = typeof todos.$inferInsert;
