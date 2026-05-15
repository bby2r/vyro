# Vyro

Personal expense + to-do tracker. Offline-first React Native (Expo) app that
syncs to a self-hosted Laravel API on the user's PC over Tailscale.

- **Frontend**: Expo + expo-router, SQLite via Drizzle, Zustand, GitHub-dark theme
- **Backend**: Laravel 13, SQLite by default
- **Sync**: opportunistic push/pull with last-writer-wins, soft-delete tombstones
- **Tenants**: device UUID stored in SecureStore; QR export/import for migration
- **AI categorization**: stubbed `Categorizer` interface; flip `AI_DRIVER` in `.env` later
- **Build**: GitHub Actions produces a release APK per commit to `master`

Planning document with full architecture, decisions, and acceptance criteria:
[`.omc/plans/vyro-mobile-v1.md`](.omc/plans/vyro-mobile-v1.md).

---

## Repo layout

```
vyro/
├── app/, bootstrap/, config/, database/, routes/, tests/   # Laravel backend
├── mobile/                                                 # Expo app
│   ├── app/                                                # screens (expo-router)
│   ├── src/                                                # services, stores, db, theme
│   ├── __tests__/                                          # Jest
│   └── app.json
├── sh/                                                     # launchd plist templates
└── .github/workflows/android-apk.yml                       # APK CI
```

---

## Backend setup (PC)

Prerequisites: PHP 8.3+, Composer, Node 20+, `sqlite3` CLI (optional).

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan test          # 38 tests should pass
```

Run the API server, queue worker, and scheduler:

```bash
# In three separate terminals (or use the launchd plists in sh/):
php artisan serve --host=0.0.0.0 --port=8000
php artisan queue:work
php artisan schedule:work
```

`--host=0.0.0.0` is required so Tailscale-connected devices can reach the API.

### Persistent queue + scheduler on macOS (launchd)

Templates live in `sh/`. Edit the `REPLACE_ME` paths in each plist (the PHP
binary path and the project root), copy them, and load:

```bash
cp sh/com.vyro.queue.plist    ~/Library/LaunchAgents/
cp sh/com.vyro.schedule.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.vyro.queue.plist
launchctl load ~/Library/LaunchAgents/com.vyro.schedule.plist

# Sanity check
launchctl list | grep vyro
tail -f /tmp/vyro-queue.log /tmp/vyro-schedule.log
```

The scheduler triggers `CategorizeEntriesJob` twice a day (09:00, 21:00).
By default `AI_DRIVER=null`, so the job runs as a no-op until you pick a
provider — set `AI_DRIVER` to `claude`, `openai`, or `ollama` in `.env` and
implement the corresponding adapter in `app/Services/Ai/`.

---

## Connecting the phone over Tailscale

[Tailscale](https://tailscale.com) is a peer-to-peer VPN (free for personal
use, up to 100 devices). It gives both PC and phone a stable private IP/DNS
name, so the phone can hit the backend from anywhere — home Wi-Fi, cellular,
or public hotspots.

1. Install the Tailscale app on PC and phone, sign in to both with the same
   account.
2. On the PC, find its Tailscale name: `tailscale status` (look for the entry
   like `your-mac.tail123abc.ts.net`).
3. In the mobile app's Settings → Backend URL, enter
   `http://your-mac.tail123abc.ts.net:8000`.
4. Tap **Test connection** in Settings — should turn green with latency in ms.

HTTPS via `tailscale cert` is optional and not required for a private mesh.

---

## Mobile setup (development)

```bash
cd mobile
npm install
npx expo start          # then "a" to open Android emulator, or scan QR with the Expo Go app
```

To produce a sideloadable APK locally (same flow CI uses):

```bash
cd mobile
npx expo prebuild --platform android --no-install --clean
cd android
./gradlew assembleRelease
# APK at mobile/android/app/build/outputs/apk/release/app-release.apk
```

---

## Building the APK via GitHub Actions

`.github/workflows/android-apk.yml` runs on every push to `master` and on
manual `workflow_dispatch`. It runs the mobile tests, prebuilds the Expo
project, runs `./gradlew assembleRelease`, and uploads the APK as an artifact
named `vyro-<sha>-apk`. Download it from the workflow run summary and
sideload onto your Android device.

The APK is **debug-signed** by default — fine for personal sideloading. To
ship a release-signed build later: generate a keystore, base64-encode it,
store in a GitHub Secret (`ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
`KEY_ALIAS`, `KEY_PASSWORD`), and decode + configure signing in the workflow
before the Gradle step. See plan §11 follow-ups.

---

## Tenant identification and migration

There is no login. Each app install generates a UUID on first launch (via
`expo-crypto.randomUUID()`) and stores it in `expo-secure-store`. Every API
request includes `X-Tenant-UUID: <uuid>`; the backend `ResolveTenant`
middleware looks up or creates the matching `Tenant` row.

**App updates** (Play Store / sideload) preserve SecureStore and the local
SQLite DB — no data loss.

**Reinstall or new device** — Android wipes the app sandbox on uninstall. To
preserve data:

1. Before uninstalling: open the app → Settings → Export Tenant → save the QR
   code (or note the UUID).
2. On the new install: tap Import Tenant in Settings → scan the QR (or paste
   the UUID) → app overwrites the local UUID and pulls all history from the
   backend.

If the user never exports the QR and the local DB is wiped, the data is
**unrecoverable** from the device, but everything that was synced to the
backend is intact and can be restored by manually setting the UUID. The app
shows a one-time warning banner in Settings until the user has exported.

---

## Tests

Backend:

```bash
php artisan test --compact
```

Mobile:

```bash
cd mobile && npm test
```

Both should be green before merging anything. CI runs the mobile tests as
part of the APK workflow; add a separate workflow for `php artisan test` if
the backend grows.

---

## License

MIT.
