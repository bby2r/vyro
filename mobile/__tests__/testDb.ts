/**
 * Test-only DB factory. Uses better-sqlite3 in-memory + drizzle's bun-sqlite-like
 * interface adapted via a thin shim. We mirror the production schema 1:1.
 */

import BetterSqlite3 from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/src/db/schema';

export type TestDb = BetterSQLite3Database<typeof schema>;

const CREATE_SQL = `
CREATE TABLE expenses (
  client_id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT,
  labels TEXT,
  occurred_at INTEGER NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER
);
CREATE TABLE todos (
  client_id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  due_at INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  labels TEXT,
  estimated_minutes INTEGER,
  notification_id TEXT,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER
);
`;

export function makeTestDb(): TestDb {
  const sqlite = new BetterSqlite3(':memory:');
  sqlite.exec(CREATE_SQL);
  return drizzle(sqlite, { schema });
}
