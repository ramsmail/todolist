# Mobile Dev — Lessons Learned

Hard-won gotchas from the Expo Router migration (Phase 0) and standing up the
EAS dev-build loop. Read this before debugging a mobile build/run problem — most
of what bites here is silent or misleading at first.

Grouped by area:
1. Expo Router migration regressions
2. On-device dev loop (Metro, adb, dev client)
3. Local native build (`expo run:android`) failures
4. EAS build & setup

---

## 1. Expo Router migration regressions

### 1.1 `crypto.randomUUID()` doesn't exist on a standalone Hermes build
- **Symptom:** "Could not save task" on device; logcat shows
  `ReactNativeJS: 'createTask failed:', [ReferenceError: Property 'crypto' doesn't exist]`.
- **Cause:** `packages/db` (`createTask`, `createAttachment`) generates ids with
  `crypto.randomUUID()`. That global exists on web and **in Expo Go** (it ships
  polyfills) but **not in a standalone Hermes build**. A pure-JS polyfill lived
  in `apps/mobile/src/polyfills.ts` and was imported by the old `src/index.tsx`
  entry — the Expo Router migration **deleted that entry and dropped the import**,
  so the polyfill silently stopped loading.
- **Fix:** Import `../polyfills` as the **first line** of `src/app/_layout.tsx`
  (root layout), before any write path runs.
- **Why it hid:** web works, Expo Go works — only a real standalone build fails.
  So it surfaced on the first on-device task create, not in earlier testing.
- **Rule:** Keep this polyfill JS-only. Do **not** swap in `expo-crypto` (native
  module) — see 2.5.

### 1.2 Deleting the entry file drops everything it imported
- The old `src/index.tsx` was the single import site for entry-time setup
  (polyfills, etc.). When replacing it with `expo-router/entry`, audit what the
  old entry imported and re-home those imports (root `_layout.tsx` is the new
  entry-time hook). The crypto break above was one instance of this.

### 1.3 Removed deps that the migration still referenced
- **`lucide-react-native`** (tab icons) wasn't installed; an interim edit
  replaced icons with text. Reinstalled and restored. Lesson: when a migration
  touches a file using a package, confirm the package is actually a dependency.

---

## 2. On-device dev loop (Metro, adb, dev client)

### 2.1 Phone can't reach Metro over Wi-Fi → use an adb reverse tunnel
- **Symptom:** dev client stuck on "Connecting", or "failed to connect" to
  `exp://<lan-ip>:8081`. Common when the phone is on **5G / mobile data** or a
  different network than the laptop.
- **Fix:** tunnel Metro over USB:
  ```bash
  adb reverse tcp:8081 tcp:8081
  ```
  then point the dev client at `exp://localhost:8081`.
- **Gotcha:** the reverse mapping **clears on USB reconnect / device reboot**.
  Re-run it (and `adb reverse --list` to confirm `UsbFfs tcp:8081 tcp:8081`).

### 2.2 `npx expo start` crashes on React Native DevTools in a headless env
- **Symptom:** Metro dies at boot with
  `FATAL ... zygote_host_impl_linux.cc ... Check failed` while
  "installing React Native DevTools" — a Chromium zygote sandbox failure.
- **Fix:** start in non-interactive mode so the DevTools launcher is skipped:
  ```bash
  CI=1 npx expo start --dev-client
  ```
- Confirm Metro is actually serving (not just holding the port):
  `curl -s http://localhost:8081/status` → `packager-status:running`.

### 2.3 Loading the dev client via deep link (no QR / no typing)
- `exp://...` does **not** resolve to the app's activity. The dev client deep
  link uses the **app scheme + dev-client path**:
  ```bash
  adb shell am start -a android.intent.action.VIEW \
    -d "todolist://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
    com.rameshv.todolist
  ```

### 2.4 Force a genuinely fresh bundle
- Re-sending the deep link to an already-running app only brings it forward
  ("delivered to currently running top-most instance") — it won't reload new JS.
  Force it:
  ```bash
  adb shell am force-stop com.rameshv.todolist
  # then re-run the deep link from 2.3
  ```

### 2.5 JS-only fix vs native change — what can hot-reload
- A **JS-only** change (e.g. the crypto polyfill) reloads onto the existing dev
  build over Metro — no rebuild.
- A **native** change (a new native module, a config plugin that edits the
  Android manifest) is **not** in the installed APK, so importing it would crash
  the current build. It requires a fresh `eas build` / `run:android`.
- This is why we used the pure-JS UUID polyfill instead of `expo-crypto`, and
  why **Phase 3.2 (`expo-share-intent`) needs a new build**.

### 2.6 `/index.bundle` 404 is a red herring for Expo apps
- Manually probing `http://localhost:8081/index.bundle` 404s — that's the bare
  React Native convention. Expo Router uses a **virtual entry**; the dev client
  fetches a **manifest from `/`** (HTTP 200) which names the real bundle URL.
  Test with `curl -H "expo-platform: android" http://localhost:8081/`.

---

## 3. Local native build (`expo run:android`) failures

In this monorepo/environment, local Gradle/CMake builds were flaky-to-broken.
Order of issues hit (each unblocked the next):

### 3.1 React / RN version skew between packages (root cause of several)
- `packages/ui` was on **React 18 / RN 0.73** while `apps/mobile` was on
  **React 19 / RN 0.85**. The skew breaks native autolinking/codegen.
- **Fix:** align `packages/ui` to React `19.2.3` / RN `0.85.3`; drop
  `@types/react-native` (types ship with RN 0.85). Keep shared packages in lock-
  step with the app's RN version.

### 3.2 Corrupted Gradle cache → "Truncated class file"
- **Fix:** clear caches and rebuild:
  ```bash
  rm -rf apps/mobile/android/build apps/mobile/android/.gradle ~/.gradle/caches
  ```

### 3.3 `react-native-reanimated:generateCodegenArtifactsFromSchema` MD5 failure
- "Failed to create MD5 hash for file: .../NativeReanimatedModuleSpec.java
  (No such file or directory)".
- **Fix:** delete reanimated's stale android build dir, rebuild:
  `rm -rf node_modules/.pnpm/react-native-reanimated*/node_modules/react-native-reanimated/android/build`

### 3.4 Kotlin daemon crash ("Daemon compilation failed: null")
- **Fix:** `rm -rf ~/.gradle/kotlin-dsl` and rebuild.

### 3.5 PowerSync op-sqlite duplicate `BuildConfig.class`
- `:powersync_op-sqlite:bundleLibRuntimeToDirDebug FAILED ... BuildConfig.class
  already exists, it cannot be overwritten`.
- Stale intermediates. `./gradlew clean` and clearing the module's android/build
  helped, but...

### 3.6 CMake: codegen jni directories "not an existing directory"
- Deep autolinking/codegen breakage across op-sqlite, gesture-handler,
  reanimated, worklets. At this point local debugging hit diminishing returns.
- **Decision:** stop fighting local Gradle/CMake and use **EAS Build** as the
  supported path for the native client. (Local `run:android` may still work on a
  developer's own machine; it's not *required* — but EAS is reliable here.)

---

## 4. EAS build & setup

### 4.1 Don't pre-create the project in the dashboard
- `eas init` creates and links the project automatically and writes
  `extra.eas.projectId` into `app.json`. Manually creating it first risks a
  slug/owner mismatch. We also added `owner: "ramsmail"` so ownership resolves
  unambiguously (useful in CI).

### 4.2 Gitignored `.env` is NOT available to cloud builds
- EAS builds run on Expo's servers and won't see the local `.env`. Push the
  `EXPO_PUBLIC_*` vars to the matching EAS environment:
  ```bash
  eas env:push development --path .env   # default --path is .env.local, so be explicit
  ```
  (These are `EXPO_PUBLIC_*` → bundled into the client → stored as plaintext,
  which is correct; they're not secrets.)

### 4.3 Build profiles & distribution
- `apps/mobile/eas.json`: `development` = dev client (needs Metro),
  `preview` = standalone internal APK (no laptop — hand to testers),
  `production` = store AAB. See `docs/DISTRIBUTION.md` for the accounts model.

### 4.4 Free-tier queue
- "Waiting for available worker" is normal on the free tier; the build starts on
  its own. It runs on EAS regardless of your browser — you can close the page.

### 4.5 Browser "access other apps/services on this device" prompt
- Shown by `expo.dev` when offering to open a desktop helper (Orbit). Not needed
  for monitoring a build or downloading the APK over HTTPS — safe to **Block**.

---

## 5. Schema / data model (bottom-up)

### 5.1 Migration files can be un-applied on the remote DB — verify LIVE, first
- **Symptom:** A shared-URL task saved on device but never synced to web. No app
  crash, no obvious error — a silent sync failure.
- **Cause:** `tasks.source_url` existed as a migration *file* but was never pushed
  to the remote Supabase DB (0002 + 0003 unapplied; only 0001 was). PowerSync's
  upload to Postgres was rejected with `42703 column tasks.source_url does not
  exist` and retried forever; the row never reached the server. Phase 0 tasks
  synced because they had `source_url = null` (the connector omits null columns),
  masking the gap until a task actually set the column.
- **Rule (bottom-up):** apply and **verify the data model against the live DB
  before** building features on it. A migration file is not "done" until it is
  live in Postgres *and* reaching clients.
- **Quick probe** (needs only the anon key):
  ```bash
  curl -s -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
    "$SUPABASE_URL/rest/v1/<table>?select=<col>&limit=1"
  # []  -> column exists (RLS hides rows for anon)
  # {"code":"42703", ... does not exist} -> migration NOT applied
  ```
- **Order:** migration → push it LIVE (`supabase db push` or dashboard SQL) →
  sync rules (`SELECT *` already covers new columns) → `packages/db` types →
  rebuild `packages/db` → feature code.
- The Supabase CLI auto-loads `.env` from cwd and dies if it's not strict
  `KEY=value` (`failed to parse environment file`). If a stray/notes `.env` is
  present, run push from a clean dir or use the dashboard SQL editor.

## TL;DR triage
- **"Could not save task" / `crypto` undefined** → polyfill import missing (1.1).
- **Dev client won't connect** → `adb reverse tcp:8081 tcp:8081`, use
  `localhost:8081` (2.1).
- **Metro dies at boot** → `CI=1 npx expo start --dev-client` (2.2).
- **My JS fix isn't showing** → force-stop + redeploy; confirm it's not a native
  change needing a rebuild (2.4, 2.5).
- **Local Gradle/CMake hell** → align RN versions (3.1), clear caches (3.2–3.5),
  or just use EAS (3.6).
- **EAS build can't reach Supabase/PowerSync** → `eas env:push` the `.env` (4.2).
