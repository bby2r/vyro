import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const USD_TO_KGS_MIGRATION_KEY = 'migration_usdToKgs_v1_done';

/**
 * DB bootstrap. We open vyro.db once and reuse the handle for the app lifetime.
 *
 * Migration strategy: manual CREATE TABLE IF NOT EXISTS bootstrap for v1.
 * drizzle-kit's expo-sqlite migration runtime requires an extra babel plugin
 * and a generated bundle; the manual path is simpler and ships faster.
 * Schema changes in v2 will introduce drizzle migrations proper.
 */
const sqlite = SQLite.openDatabaseSync('vyro.db');

export const db = drizzle(sqlite, { schema });

export async function runMigrations(): Promise<void> {
  await sqlite.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
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

    CREATE INDEX IF NOT EXISTS expenses_updated_at_idx ON expenses(updated_at);
    CREATE INDEX IF NOT EXISTS expenses_occurred_at_idx ON expenses(occurred_at);

    CREATE TABLE IF NOT EXISTS todos (
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

    CREATE INDEX IF NOT EXISTS todos_updated_at_idx ON todos(updated_at);
    CREATE INDEX IF NOT EXISTS todos_due_at_idx ON todos(due_at);
  `);

  // One-time relabel: existing rows we created with the 'USD' default actually
  // mean Kyrgyz som for this user. Run once per install and remember via
  // SecureStore so we don't clobber legitimate USD entries on later runs.
  try {
    const done = await SecureStore.getItemAsync(USD_TO_KGS_MIGRATION_KEY);
    if (done !== '1') {
      await sqlite.execAsync(`UPDATE expenses SET currency = 'KGS' WHERE currency = 'USD';`);
      await SecureStore.setItemAsync(USD_TO_KGS_MIGRATION_KEY, '1');
    }
  } catch {
    // SecureStore may be unavailable in tests; harmless to retry next launch.
  }
}
