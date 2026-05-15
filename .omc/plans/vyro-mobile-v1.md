# Vyro Mobile v1 — Expense Tracker + To-Do List with Reminders

**Created:** 2026-05-16
**Owner:** Baitur (single-user, multi-tenant by device)
**Repo state:** Fresh Laravel 13 skeleton, no domain code yet
**Status:** Plan ready for execution

---

## 1. Requirements Summary

A personal mobile app (React Native / Expo) for tracking expenses and to-dos with reminders. Offline-first; syncs to a self-hosted Laravel backend (running on the user's PC, exposed over Tailscale) in the background whenever reachable. No login — tenants are identified by an auto-generated device UUID. A twice-daily Laravel queued job will eventually call an AI provider to categorize/label entries; for v1 the AI layer is stubbed behind an interface so a provider can be plugged in later without schema changes.

**Out of scope for v1:** iOS build (Android only via GitHub Actions APK), multi-user-per-device, real-time push from backend to phone, attachments/photos.

---

## 2. RALPLAN-DR Summary

### Principles
1. **Offline-first is non-negotiable.** Every write succeeds locally without network. Sync is opportunistic.
2. **Speed > features.** Launch-to-form must be <300ms cold, <100ms warm. No spinners on the form path.
3. **Simple sync semantics.** Last-writer-wins by `updated_at`, soft deletes via `deleted_at`, no CRDTs.
4. **Tenant portability.** The device UUID is exportable so data survives reinstalls and device migrations.
5. **AI is decoupled.** Provider choice is a config flag; the rest of the system never imports a provider SDK directly.

### Decision Drivers (top 3)
1. **Solo-developer velocity** — every choice that adds setup friction must justify itself.
2. **Zero-cost hosting** — backend runs on user's PC; no cloud bills; Tailscale = $0; CI = GitHub free tier.
3. **Reinstall/device-change resilience** — uninstalling Android wipes SQLite, so backend must hold authoritative state and there must be a UX path to recover.

### Viable Options & Decisions

| Decision | Chosen | Rejected alternatives & why |
|---|---|---|
| RN flavor | **Expo + local prebuild** | Bare RN: more boilerplate, slower iteration. EAS Build: extra account / billing surface for no gain over local Gradle. |
| Local DB | **expo-sqlite + Drizzle ORM** | WatermelonDB: heavy sync layer we don't need; AsyncStorage: not relational; op-sqlite: minor perf win, more setup. |
| Charts | **react-native-gifted-charts** | Victory Native: larger bundle, steeper API; SVG-charts: less polished. |
| Backend reach | **Tailscale** | LAN-only: dead away from home; Cloudflare Tunnel: extra moving part, public endpoint surface. |
| Tenant ID | **Device UUID + QR export/import** | User-typed name: easy to collide / forget. UUID alone: no migration path. |
| AI provider | **Stub interface, defer pick** | Locking in now blocks the build for a feature that's twice-daily and batch-friendly. |
| Sync conflict | **Last-writer-wins by `updated_at`** | CRDTs / OT: massive overkill for single-user-per-tenant. |
| Reminders | **expo-notifications, local-scheduled** | Push from server: needs FCM project, server keys, and tunnel-callable phone — too much for a personal tool. |
| State mgmt | **Zustand + TanStack Query (local-first)** | Redux Toolkit: more boilerplate; raw context: re-render storms. |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────┐         ┌────────────────────────────────────┐
│  Phone (Android, Expo app)                  │         │  PC (Laravel + MySQL/SQLite)       │
│                                             │         │                                    │
│  ┌─────────────┐    ┌──────────────────┐    │  HTTPS  │  ┌────────────────────────────┐    │
│  │  UI (Tabs)  │───▶│ Zustand stores   │    │  via    │  │ API (Sanctum-less, header) │    │
│  └─────────────┘    └────────┬─────────┘    │Tailscale│  │  /api/v1/sync/{push,pull}  │    │
│                              ▼              │◀───────▶│  │  /api/v1/tenant/transfer   │    │
│                     ┌──────────────────┐    │         │  └────────────┬───────────────┘    │
│                     │ Drizzle ORM      │    │         │               ▼                    │
│                     │ expo-sqlite      │    │         │  ┌────────────────────────────┐    │
│                     └────────┬─────────┘    │         │  │ Eloquent (per-tenant scope)│    │
│                              ▼              │         │  └────────────┬───────────────┘    │
│                     ┌──────────────────┐    │         │               ▼                    │
│                     │ SyncService      │    │         │  ┌────────────────────────────┐    │
│                     │ (background task)│    │         │  │ MySQL / SQLite             │    │
│                     └──────────────────┘    │         │  └────────────────────────────┘    │
│                                             │         │                                    │
│                     ┌──────────────────┐    │         │  ┌────────────────────────────┐    │
│                     │ expo-notifications│   │         │  │ Scheduler: CategorizeJob   │    │
│                     │ (local reminders) │   │         │  │  → AI Categorizer (stub)   │    │
│                     └──────────────────┘    │         │  └────────────────────────────┘    │
└─────────────────────────────────────────────┘         └────────────────────────────────────┘
```

### Module layout

```
vyro/
├── app/                            # Laravel backend (existing skeleton)
│   ├── Http/Controllers/Api/V1/
│   │   ├── SyncController.php
│   │   └── TenantController.php
│   ├── Models/
│   │   ├── Tenant.php
│   │   ├── Expense.php
│   │   └── Todo.php
│   ├── Services/Sync/
│   │   ├── SyncService.php
│   │   └── ConflictResolver.php
│   ├── Services/Ai/
│   │   ├── Categorizer.php         # interface
│   │   ├── NullCategorizer.php     # default
│   │   ├── ClaudeCategorizer.php   # stub
│   │   ├── OpenAiCategorizer.php   # stub
│   │   └── OllamaCategorizer.php   # stub
│   ├── Jobs/CategorizeEntriesJob.php
│   └── Console/Commands/RunCategorization.php
├── database/migrations/            # new migrations below
├── routes/api.php                  # NEW file
├── config/ai.php                   # NEW
├── mobile/                         # NEW — Expo app
│   ├── app/                        # expo-router screens
│   │   ├── _layout.tsx             # root: theme provider, db init
│   │   ├── (tabs)/                 # bottom-tabbed root: Expenses, Todos, Settings
│   │   ├── expenses/
│   │   │   ├── _layout.tsx         # top-tabs: Form, List, Stats
│   │   │   ├── form.tsx
│   │   │   ├── list.tsx
│   │   │   └── stats.tsx
│   │   ├── todos/
│   │   │   ├── _layout.tsx         # top-tabs: Form, List
│   │   │   ├── form.tsx
│   │   │   └── list.tsx
│   │   └── settings/
│   │       ├── index.tsx
│   │       ├── export.tsx          # QR with UUID
│   │       └── import.tsx          # QR scanner
│   ├── src/
│   │   ├── db/                     # Drizzle schema + migrations
│   │   ├── stores/                 # Zustand stores (theme, tenant, sync status)
│   │   ├── sync/                   # SyncService, NetInfo listener, BackgroundFetch task
│   │   ├── api/                    # fetch wrapper, endpoints
│   │   ├── theme/                  # GitHub-dark + light tokens
│   │   ├── components/             # shared UI (Button, Input, Icon, …)
│   │   └── notifications/          # expo-notifications scheduling
│   ├── app.json                    # Expo config (notifications, permissions)
│   ├── eas.json                    # kept minimal; CI uses local prebuild
│   └── package.json
└── .github/workflows/
    └── android-apk.yml             # NEW — builds release APK on push to master
```

---

## 4. Backend Implementation Plan (Laravel)

### 4.1 Database schema (new migrations)

Run these via `php artisan make:migration` then edit:

**`create_tenants_table`**
```php
Schema::create('tenants', function (Blueprint $table) {
    $table->id();
    $table->uuid('uuid')->unique();          // matches mobile device UUID
    $table->string('label')->nullable();     // optional friendly name
    $table->timestamp('last_synced_at')->nullable();
    $table->timestamps();
});
```

**`create_expenses_table`**
```php
Schema::create('expenses', function (Blueprint $table) {
    $table->id();
    $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
    $table->uuid('client_id')->unique();          // generated on phone, idempotency key
    $table->string('description');
    $table->unsignedBigInteger('amount_cents');   // store cents to avoid float drift
    $table->string('currency', 3)->default('USD');
    $table->string('category')->nullable();       // populated by AI later
    $table->json('labels')->nullable();           // populated by AI later
    $table->timestamp('occurred_at');             // when the expense happened (phone time)
    $table->timestamp('deleted_at')->nullable();  // soft delete for sync
    $table->timestamps();                         // updated_at drives conflict resolution
    $table->index(['tenant_id', 'updated_at']);
    $table->index(['tenant_id', 'occurred_at']);
});
```

**`create_todos_table`**
```php
Schema::create('todos', function (Blueprint $table) {
    $table->id();
    $table->foreignId('tenant_id')->constrained()->cascadeOnDelete();
    $table->uuid('client_id')->unique();
    $table->string('title');
    $table->timestamp('due_at')->nullable();
    $table->boolean('done')->default(false);
    $table->string('category')->nullable();       // AI
    $table->json('labels')->nullable();           // AI
    $table->unsignedInteger('estimated_minutes')->nullable(); // AI may set
    $table->timestamp('deleted_at')->nullable();
    $table->timestamps();
    $table->index(['tenant_id', 'updated_at']);
    $table->index(['tenant_id', 'due_at']);
});
```

Drop the default `users` table migration or leave it — it's unused but harmless. Recommend deleting `0001_01_01_000000_create_users_table.php` and `database/factories/UserFactory.php` to keep the schema lean.

### 4.2 Models

`app/Models/Tenant.php`, `Expense.php`, `Todo.php` — standard Eloquent, with:
- `$fillable` and `$casts` (`amount_cents:int`, `labels:array`, `occurred_at`/`due_at:datetime`)
- `Expense::booted()` and `Todo::booted()` add a global scope when a `tenant_id` is bound in the request lifecycle (via a middleware-set container binding) — denies cross-tenant reads at the model layer.
- Factories for each (`php artisan make:factory ExpenseFactory --model=Expense`) — used in tests, not in production paths.

### 4.3 Tenant resolution middleware

`app/Http/Middleware/ResolveTenant.php`:
- Reads `X-Tenant-UUID` header
- Looks up or creates the `Tenant` row
- Binds it in the container (`app()->instance('current.tenant', $tenant)`)
- Returns 400 if header missing

Register globally for the `api` group in `bootstrap/app.php`.

### 4.4 API routes (`routes/api.php` — create file)

```php
Route::prefix('v1')->middleware(['api', \App\Http\Middleware\ResolveTenant::class])->group(function () {
    Route::post('sync/push', [SyncController::class, 'push']);
    Route::get('sync/pull',  [SyncController::class, 'pull']);
    Route::post('tenant/transfer', [TenantController::class, 'transfer']); // change UUID
    Route::get('tenant/me', [TenantController::class, 'me']);
});
```

Wire `routes/api.php` into `bootstrap/app.php` (Laravel 13 doesn't auto-load it):
```php
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    apiPrefix: 'api',
    commands: __DIR__.'/../routes/console.php',
)
```

### 4.5 Sync protocol

**POST `/api/v1/sync/push`** — body:
```json
{
  "expenses": [{"client_id":"<uuid>","description":"...","amount_cents":1250,"occurred_at":"2026-05-16T10:11:00Z","updated_at":"2026-05-16T10:11:00Z","deleted_at":null}],
  "todos":    [{"client_id":"<uuid>","title":"...","due_at":null,"done":false,"updated_at":"...","deleted_at":null}]
}
```
Server upserts by `client_id`, applies last-writer-wins on `updated_at` (skip if server row is newer). Returns the canonical version of each accepted row.

**GET `/api/v1/sync/pull?since=<ISO8601>`** — returns:
```json
{
  "server_time": "2026-05-16T10:30:00Z",
  "expenses": [...],
  "todos":    [...]
}
```
Includes soft-deleted rows (`deleted_at` set) so the client can apply tombstones.

**Conflict rule:** for the same `client_id`, the row with the later `updated_at` wins. Equal timestamps → server's row wins (deterministic).

### 4.6 Tenant transfer endpoint

**POST `/api/v1/tenant/transfer`** — body `{"new_uuid":"..."}`. Renames the current tenant's UUID. Used when migrating between devices: new device generates a UUID, scans the old QR, then calls this endpoint with the old UUID in the header and the new UUID in the body — backend rebinds the tenant row. (Alternative discussed in §6.3.)

### 4.7 AI categorization (stubbed)

**`config/ai.php`:**
```php
return [
    'driver' => env('AI_DRIVER', 'null'), // null | claude | openai | ollama
    'claude' => ['key' => env('ANTHROPIC_API_KEY'), 'model' => 'claude-haiku-4-5'],
    'openai' => ['key' => env('OPENAI_API_KEY'), 'model' => 'gpt-4o-mini'],
    'ollama' => ['base' => env('OLLAMA_BASE', 'http://127.0.0.1:11434'), 'model' => 'qwen2.5:3b'],
];
```

**`app/Services/Ai/Categorizer.php` (interface):**
```php
interface Categorizer {
    /** @return array{category:?string, labels:array<int,string>, estimated_minutes:?int} */
    public function categorize(string $text, string $kind /* 'expense'|'todo' */): array;
}
```

**`NullCategorizer`** returns empty arrays. Bound by default in `AppServiceProvider::register()`:
```php
$this->app->bind(Categorizer::class, function () {
    return match (config('ai.driver')) {
        'claude' => new ClaudeCategorizer(...),
        'openai' => new OpenAiCategorizer(...),
        'ollama' => new OllamaCategorizer(...),
        default  => new NullCategorizer(),
    };
});
```

Stub implementations have the HTTP call sketched but throw `NotImplemented` so the wiring is testable; user fills in when picking a provider.

**`CategorizeEntriesJob`** (queueable):
- Iterates per-tenant
- Selects rows in last 7 days where `category IS NULL` (LIMIT 50 per kind to bound cost)
- Calls `Categorizer::categorize()` per row, persists result
- Logs counts

**Schedule** in `routes/console.php`:
```php
Schedule::job(new CategorizeEntriesJob)->twiceDaily(9, 21);
```

User runs `php artisan schedule:work` in a tmux pane on their PC, or installs a launchd plist (covered in §8).

### 4.8 Backend tests (PHPUnit)

- `Tests\Feature\Api\SyncPushTest` — push idempotent on same `client_id`, conflict resolution, soft-delete tombstones
- `Tests\Feature\Api\SyncPullTest` — `since` filter, pagination not needed at this scale (<10k rows), tenant isolation
- `Tests\Feature\Api\TenantTransferTest` — UUID rename, rejects existing UUID
- `Tests\Feature\Middleware\ResolveTenantTest` — missing header → 400, new UUID auto-creates tenant
- `Tests\Unit\Services\Ai\NullCategorizerTest` — returns empty shape
- `Tests\Feature\Jobs\CategorizeEntriesJobTest` — uses `NullCategorizer`, asserts no DB changes for null driver

All using factories. Target: every controller method + sync semantics covered.

---

## 5. Mobile Implementation Plan (Expo / React Native)

### 5.1 Scaffold

```bash
cd /Users/baiturbulanbekov/PhpStormProjects/vyro
npx create-expo-app@latest mobile --template tabs   # picks expo-router
cd mobile
npx expo install expo-sqlite expo-notifications expo-secure-store expo-network expo-background-fetch \
                 expo-task-manager react-native-svg react-native-reanimated react-native-gesture-handler \
                 expo-crypto expo-router expo-haptics @react-native-community/netinfo
npm i drizzle-orm
npm i -D drizzle-kit
npm i zustand @tanstack/react-query react-native-gifted-charts react-native-qrcode-svg react-native-vision-camera
```

### 5.2 Database (Drizzle + expo-sqlite)

`mobile/src/db/schema.ts` — mirrors backend tables minus `tenant_id` (single-tenant on device):
```ts
export const expenses = sqliteTable('expenses', {
  client_id: text('client_id').primaryKey(),    // uuid
  description: text('description').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  currency: text('currency').default('USD'),
  category: text('category'),
  labels: text('labels'),                       // JSON-encoded
  occurred_at: integer('occurred_at', {mode: 'timestamp'}).notNull(),
  deleted_at: integer('deleted_at', {mode: 'timestamp'}),
  created_at: integer('created_at', {mode: 'timestamp'}).notNull(),
  updated_at: integer('updated_at', {mode: 'timestamp'}).notNull(),
  synced_at:  integer('synced_at',  {mode: 'timestamp'}),  // null = needs push
});
```

Same shape for `todos` (`title`, `due_at`, `done`, `estimated_minutes`).

`mobile/src/db/index.ts` opens the DB once, runs Drizzle migrations at startup.

### 5.3 Tenant bootstrap

`mobile/src/stores/tenantStore.ts`:
- On first launch: `expo-crypto.randomUUID()` → store in `expo-secure-store` under key `tenantUuid`
- All API calls include `X-Tenant-UUID: <uuid>` header
- Settings → Export shows QR via `react-native-qrcode-svg`
- Settings → Import scans QR via `react-native-vision-camera` → overwrites stored UUID → triggers full pull

### 5.4 Sync service

`mobile/src/sync/SyncService.ts`:
- `pushUnsynced()` — selects rows where `synced_at IS NULL`, POSTs in one batch per kind, marks synced
- `pullSince(timestamp)` — GETs delta, upserts locally (last-writer-wins by `updated_at`)
- `runOnce()` — push then pull; updates `lastSyncedAt` in Zustand
- Trigger points:
  1. On app foreground (`AppState` listener)
  2. Every 30s while foregrounded (if backend reachable)
  3. On `NetInfo` reconnect event
  4. Background fetch task (registered via `expo-background-fetch`) ~every 15 min when OS allows
- Reachability check: HEAD `/api/v1/tenant/me` with 2s timeout; never blocks UI

UI never awaits a sync — writes are local + queued. A small "synced N min ago" status indicator on Settings tells the user.

### 5.5 Theme system

`mobile/src/theme/tokens.ts` — GitHub Dark palette:
```ts
export const dark = {
  bg:        '#0d1117',
  bgAlt:     '#161b22',
  border:    '#30363d',
  text:      '#c9d1d9',
  textMuted: '#8b949e',
  accent:    '#58a6ff',  // GitHub blue
  success:   '#3fb950',
  danger:    '#f85149',
  warning:   '#d29922',
};

export const light = {
  bg:        '#ffffff',
  bgAlt:     '#f6f8fa',
  border:    '#d0d7de',
  text:      '#1f2328',
  textMuted: '#656d76',
  accent:    '#0969da',
  success:   '#1a7f37',
  danger:    '#cf222e',
  warning:   '#9a6700',
};
```

`themeStore` (Zustand) persists choice in SecureStore; default = dark; toggle in Settings. All components read tokens via a `useTheme()` hook — no inline hex codes anywhere.

### 5.6 Screens

**Root** (`app/_layout.tsx`): mounts ThemeProvider, opens DB, runs migrations, kicks off sync, registers background fetch + notification handlers. Splash hidden only after DB is open (target <100ms warm start).

**`(tabs)/_layout.tsx`**: bottom tab bar — Expenses (default), Todos, Settings.

**Expenses → Form (default landing)**: two TextInputs (`description`, `amount`), Submit button. Submit:
1. Insert local row with `synced_at=null`, `occurred_at=now`
2. Clear inputs, focus first input again
3. Fire-and-forget `SyncService.runOnce()`
The form mounts immediately on app launch; description input is auto-focused; `keyboardShouldPersistTaps="handled"` so submit is one-tap.

**Expenses → List**: FlatList of expenses, ordered `created_at DESC`. Each row shows `MM-DD HH:mm` (no year), description, amount, and two icon buttons (`Pencil`, `Trash2` from `lucide-react-native`). Edit opens a small modal with the same form pre-filled; Delete sets `deleted_at=now`, `updated_at=now`, `synced_at=null`.

**Expenses → Stats**: four sections — Today, Yesterday, This Week, This Month. Each shows:
- Total amount (big number)
- Line graph of running total by hour/day (`react-native-gifted-charts`'s `LineChart`)
- Pie/donut of spend per `category` (uses AI-filled `category`; falls back to "Uncategorized" until job runs)
- Bar chart of top 5 descriptions/labels

All data computed locally via Drizzle queries — no server round-trip.

**Todos → Form**: `title` + optional `due_at` (using a native datetime picker, e.g. `@react-native-community/datetimepicker`). On submit:
1. Insert local row
2. If `due_at` set: schedule a local notification via `expo-notifications.scheduleNotificationAsync({trigger: due_at})` and store the resulting identifier on the row in a `notification_id` column

**Todos → List**: FlatList ordered by `done ASC, due_at ASC NULLS LAST, created_at DESC`. Each row: checkbox (toggle `done`), title, due date if any, edit + delete icon buttons. Toggling `done` cancels the pending notification.

**Settings**: theme toggle, sync status ("Last synced: 2m ago"), backend URL field (`https://your-pc.tailXXXX.ts.net`), Export Tenant (QR), Import Tenant (scanner), App version.

### 5.7 Performance budget

- Cold start to form usable: **<300ms** on Pixel 6 class
- Form submit → list updated: **<50ms** (no network in path)
- List scroll: 60fps with 1000+ rows (FlatList + `windowSize=5` + memoized rows)
- Bundle size goal: **<8MB** APK

Measured via `expo-perf` once and revisited if any screen feels slow.

### 5.8 Mobile tests (Jest + RN Testing Library)

Light suite, focus on logic not pixels:
- `SyncService.test.ts` — push/pull flows with mocked fetch + in-memory SQLite
- `db/queries.test.ts` — list ordering, stats aggregations
- `stores/tenantStore.test.ts` — bootstrap + import flow
- Snapshot tests skipped (low value, churn-prone)

CI runs `npm test` in the mobile workspace.

---

## 6. Tenant Lifecycle & Recovery

### 6.1 Normal install
1. App generates UUID on first launch → SecureStore
2. First sync push creates the `Tenant` row on backend
3. Subsequent syncs use the same UUID forever (SecureStore survives app updates from Play Store but **NOT** uninstalls)

### 6.2 App update (no data loss)
Android keeps the app sandbox across self-updates — SQLite DB and SecureStore both persist. **No action needed.**

### 6.3 Reinstall or new device
Two-step UX:

**Before:** Settings → Export Tenant → user sees QR + raw UUID + reminder "Save this. If you reinstall, scan to restore your data."

**After:** On a fresh install, the welcome screen has two buttons: "Start fresh" or "Restore from QR". Restore flow:
1. Camera scans QR → extracts UUID
2. App writes UUID to SecureStore
3. App calls `GET /api/v1/sync/pull?since=1970-01-01` (full history)
4. All rows land in local SQLite; user is back to where they were

The `POST /tenant/transfer` endpoint is **only** needed for "I want a new UUID on the same data" scenarios — not the common case. Keep it but don't expose it in v1 UI; can be called manually.

### 6.4 Lost UUID (no QR saved)
Documented as **unrecoverable** in Settings → "About". Single-user app; recommend the user always export the QR after first launch. (Could add a once-a-week reminder banner if the UUID has never been exported.)

---

## 7. GitHub Actions: Android APK build

**`.github/workflows/android-apk.yml`:**

```yaml
name: Build Android APK
on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    defaults: {run: {working-directory: mobile}}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: 20, cache: npm, cache-dependency-path: mobile/package-lock.json}
      - uses: actions/setup-java@v4
        with: {distribution: temurin, java-version: 17}
      - run: npm ci
      - run: npx expo prebuild --platform android --no-install
      - name: Gradle build
        working-directory: mobile/android
        run: ./gradlew assembleRelease
      - uses: actions/upload-artifact@v4
        with:
          name: vyro-${{ github.sha }}.apk
          path: mobile/android/app/build/outputs/apk/release/*.apk
```

**Signing:** for v1, a debug-signed release APK is fine (it's a personal app you sideload). When ready for a "stable" signed APK, generate a keystore once, base64-encode it, store in GitHub Secrets, and add a step to decode + sign. Out of v1 scope but noted in §11 follow-ups.

---

## 8. Backend deployment on user's PC

**Recommended setup** (documented in `README.md` updates, not as code):
1. Install Tailscale on PC + phone, sign in with same account
2. `php artisan serve --host=0.0.0.0 --port=8000` exposed to Tailscale interface
3. Database: SQLite (`database/database.sqlite`) for v1 — zero config, single file, easy backup. MySQL upgrade is one config swap when needed.
4. Queue worker + scheduler: macOS launchd plist (`sh/com.vyro.queue.plist`, `sh/com.vyro.schedule.plist`) — provided as templates in `sh/` directory. User loads with `launchctl load ~/Library/LaunchAgents/com.vyro.queue.plist`.
5. Phone backend URL: `http://your-pc.tailXXXX.ts.net:8000` — set in Settings.

(HTTPS via Tailscale's `tailscale cert` is a nice-to-have, not required for a private mesh.)

---

## 9. Acceptance Criteria

Each is testable. Stars (★) = manual verification step.

1. **Form-first launch.** Cold launching the app opens directly on Expenses → Form with the description input focused; no other tab/spinner intercedes. ★ Measured: time from icon tap to keyboard up on Pixel 6 ≤ 300ms.
2. **Offline write succeeds.** With airplane mode on, submitting an expense returns to a cleared form within 50ms and the entry is visible in the List tab. Verified via Jest test against in-memory SQLite + ★ device test in airplane mode.
3. **Sync resumes automatically.** After airplane-mode writes, turning Wi-Fi/Tailscale on results in those rows appearing in `expenses` table on backend within 30s without user action. ★ Verified by `database-query` on backend.
4. **List order + format.** Expenses list shows `MM-DD HH:mm` (no year), ordered `created_at DESC`. Verified via `db/queries.test.ts`.
5. **Icon-only edit/delete buttons.** Each row has exactly two icon buttons (`Pencil`, `Trash2`), no text labels. ★ Visual review.
6. **Stats tabs work.** Today / Yesterday / This Week / This Month each render a line chart + at least one other chart type, computed locally. Empty periods show "No data" placeholder, not crash. Verified via screen test with seeded data.
7. **Todos with reminders.** Creating a todo with `due_at = now + 60s` fires a local notification at that time, even when the app is killed. ★ Manual device test.
8. **Themes.** App defaults to dark theme; toggle in Settings flips all surfaces; palette matches `#0d1117/#161b22/#30363d` triple from GitHub Dark. No light-mode hex codes leak into dark mode. Verified by enumerating components for inline color literals (`grep -r "#[0-9a-fA-F]\{6\}" mobile/app mobile/src --include='*.tsx'` returns only token files).
9. **Tenant isolation.** Two requests with different `X-Tenant-UUID` headers receive disjoint data sets. Verified in `SyncPullTest`.
10. **Tenant export/import round-trip.** Generating a QR on device A, scanning on device B (or fresh install of same emulator), then opening List shows all rows from A. ★ Manual.
11. **APK build green.** Push to master → GitHub Actions completes → downloadable APK artifact. Verified via successful workflow run.
12. **AI stub is wired but inert.** With `AI_DRIVER=null`, `CategorizeEntriesJob` runs cleanly and makes zero DB changes. With `AI_DRIVER=claude` (no key set), it throws a clear `NotImplemented` error referencing the file path. Verified in `CategorizeEntriesJobTest`.
13. **Backend tests pass.** `php artisan test --compact` exits 0 with at least the test classes listed in §4.8.
14. **Pint clean.** `vendor/bin/pint --test --format agent` returns 0 issues on all modified PHP files (run before commits).
15. **No `composer require` outside approval.** Backend uses only the existing skeleton's packages (no new dependencies for v1 backend except what's already there). AI stub uses Laravel's built-in `Http` facade; no new SDK packages.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Background fetch unreliable on Android (Doze mode) | High | Med | Treat background fetch as best-effort; rely on foreground sync triggers as the contract. Document in README. |
| Tailscale latency on cold connection (~1s) | Med | Low | Sync is async; UI never waits. Reachability check has a 2s timeout. |
| User uninstalls before exporting tenant QR | Med | High | Show a one-time non-dismissable "Export your UUID" prompt 24h after first launch; also auto-snapshot UUID + last-sync info into Android's auto-backup (`android:allowBackup="true"` + `dataExtractionRules`). |
| Clock skew between phone and PC corrupting LWW | Low | Med | Server records its own `received_at`; if client `updated_at` is more than 24h in the future, server normalizes to `now()` and logs. |
| Expo SDK version drift breaking build | Med | Low | Pin SDK in `package.json`; renovate-bot config in follow-ups. |
| `react-native-vision-camera` fails on first Expo prebuild | Med | Low | Use `expo-camera` as fallback for QR scanning (slightly less responsive but no native config). Decide during scaffold. |
| SQLite DB growing past phone constraints (years of data) | Low | Low | At 1000 entries/year, DB is <1MB. Re-evaluate at 100k rows. |
| AI provider lock-in when user picks one | Low | Low | Already mitigated by interface design. |
| Schedule job not running because PC asleep | High | Low | Use `pmset` or accept "best effort twice daily when PC is on." Categorization is non-urgent. |

---

## 11. Verification Steps

After execution, verify in this order:

1. **Backend tests:** `php artisan test --compact` → all green.
2. **Pint clean:** `vendor/bin/pint --dirty --format agent`.
3. **Schema sanity:** `php artisan migrate:fresh && php artisan db:show && php artisan tinker --execute 'App\Models\Expense::factory()->count(3)->for(App\Models\Tenant::factory())->create(); dump(App\Models\Expense::count());'`
4. **API smoke test:** `curl -X POST http://localhost:8000/api/v1/sync/push -H "X-Tenant-UUID: $(uuidgen)" -H "Content-Type: application/json" -d '{"expenses":[{"client_id":"...","description":"coffee","amount_cents":350,"occurred_at":"2026-05-16T10:00:00Z","updated_at":"2026-05-16T10:00:00Z"}],"todos":[]}'` → 200 + canonical row in response.
5. **Mobile build local:** `cd mobile && npx expo prebuild --platform android && cd android && ./gradlew assembleDebug` → APK produced.
6. **Mobile unit tests:** `cd mobile && npm test`.
7. **End-to-end on device:**
   - Sideload APK, complete bootstrap, write 3 expenses + 1 todo offline (airplane mode).
   - Enable Wi-Fi + Tailscale → wait 30s → check backend via `database-query`: rows present, `category` NULL.
   - Toggle theme — verify GitHub-dark palette.
   - Export QR, fresh-install on emulator, scan QR → data appears.
8. **CI:** push to master → `Build Android APK` workflow green → download artifact → install → app launches.

### Follow-ups (post-v1)
- Signed release APK (keystore in GH Secrets)
- Pick AI provider + flip `AI_DRIVER`
- iOS build (separate workflow; needs Mac runner or EAS)
- Push-based reminders for cross-device sync
- HTTPS via `tailscale cert`
- Pagination on `/sync/pull` if dataset grows

---

## 12. ADR — Single Decision Record

### Decision
Build v1 as **Expo (with local prebuild) + Laravel API + SQLite-on-device synced over Tailscale, with a stubbed Categorizer interface awaiting provider selection.**

### Drivers
1. Solo-developer velocity (1 person, no time for incidental complexity).
2. Zero recurring cost (PC-hosted backend, free Tailscale tier, free GH Actions).
3. Reinstall/device-migration resilience (UUID export/import).

### Alternatives considered
- **Bare RN** — rejected: more setup, no benefit at v1 surface area.
- **WatermelonDB** — rejected: its sync engine is overkill when LWW-on-updated_at suffices.
- **Real-time sync (WebSockets)** — rejected: PC isn't always reachable; opportunistic batch sync covers the actual usage pattern.
- **Auth (Sanctum + simple login)** — rejected by user spec; UUID-as-identity + tenant scoping gives equivalent isolation for a private app.
- **Picking AI provider now** — deferred: feature is asynchronous and provider choice has near-zero blast radius behind the interface.

### Why chosen
The combination minimizes setup effort (`create-expo-app` + `migrate` + a workflow file), keeps the data-plane simple (LWW + tombstones is ~200 LOC), gives complete offline functionality from day one, and leaves a clean seam (the `Categorizer` interface) for the only piece that's intentionally vague.

### Consequences
- (+) New writes work everywhere, sync catches up later.
- (+) Adding the AI later = changing a config flag.
- (+) CI APK build needs no Expo account.
- (-) Sync is eventually consistent; if the user edits the same row on two devices within seconds, the later `updated_at` wins (acceptable for single-user).
- (-) User must export the QR or risk losing data on uninstall — mitigated by reminder banner.
- (-) Background sync is best-effort on Android; foreground sync is the contract.

### Follow-ups
See §11.

---

## 13. Execution Order (for the executor agent)

Recommend doing this as **6 commits**, each independently runnable and tested:

1. **Backend foundation** — migrations, models, factories, `ResolveTenant` middleware, wire `routes/api.php`, tests for middleware. (No API endpoints yet.)
2. **Sync API + tests** — `SyncController`, `SyncService`, `TenantController`, full PHPUnit coverage.
3. **AI scaffolding** — `Categorizer` interface, `NullCategorizer`, stub adapters, `CategorizeEntriesJob`, schedule entry, tests.
4. **Mobile scaffold** — `create-expo-app`, dependencies, theme tokens, DB schema + Drizzle migrations, tenantStore, basic tab nav.
5. **Mobile features** — Expense form/list/stats screens, Todo form/list screens, notification scheduling, SyncService, settings (theme + QR export/import).
6. **CI + docs** — GitHub Actions workflow, README updates (Tailscale setup, launchd plists in `sh/`), Pint clean pass.

Each commit ends with `php artisan test --compact` (where backend changed) and `npm test` in `mobile/` (where mobile changed) both green, and `vendor/bin/pint --dirty --format agent` returning clean.
