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

### 2.7 One-shot recovery: relaunch the dev client into Metro over USB
When the app "won't launch" / "won't connect" / is stuck connecting — usually
the reverse tunnel dropped (2.1) and/or the app is holding a stale/half state.
This block re-sets the tunnel, force-stops the app, and deep-links it back into
Metro for a clean load. It's the go-to reset and safe to re-run any time:
```bash
adb reverse tcp:8081 tcp:8081                       # tunnel drops on replug (2.1)
adb shell am force-stop com.rameshv.todolist        # clear stale state (2.4)
adb shell am start -a android.intent.action.VIEW \
  -d "todolist://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  com.rameshv.todolist                              # deep-link into Metro (2.3)
```
Confirm it worked by watching Metro's log for an `Android Bundled …` line (the
device fetched the bundle). Prereqs: Metro up (`CI=1 npx expo start
--dev-client`, 2.2) and `adb devices` shows the device.

### 2.8 Tunnel mode: dev loop without USB or LAN
- **Symptom:** phone can't reach the laptop over Wi-Fi at all — not just "on 5G
  data" (2.1), but stuck even on the *same* Wi-Fi network. Often a router doing
  AP/client isolation or 2.4GHz/5GHz band separation between the two devices.
  USB + `adb reverse` (2.1/2.7) always works around this, but requires the cable.
- **Fix:** route Metro through Expo's built-in ngrok tunnel instead of LAN:
  ```bash
  npm i -g @expo/ngrok        # one-time
  pnpm --filter @todolist/mobile start:tunnel
  # or directly: CI=1 npx expo start --dev-client --tunnel
  ```
  This prints (and serves the manifest from) a public
  `https://<id>-ramsmail-8081.exp.direct` URL. On the phone, open the dev
  client → "Enter URL manually" → paste that URL (or scan the terminal QR). No
  adb, no USB, no shared Wi-Fi network required — works even with the phone on
  cellular data and Wi-Fi off entirely.
- **Verify the tunnel is actually up** (same DevTools-crash caveat as 2.2
  applies — `CI=1` is required, the crash message is harmless):
  ```bash
  curl -s http://localhost:8081/status                 # packager-status:running
  curl -s http://localhost:4040/api/tunnels             # ngrok's local API; confirms public_url
  ```
- **Caveat:** the tunnel is a public relay hop, so it's slower and occasionally
  flakier than a working LAN connection. Use it when LAN/USB aren't available;
  prefer 2.1's `adb reverse` when the cable is handy and speed matters.
- **Fully laptop-free alternative:** for verifying a build without any dev
  server at all (no tunnel, no Metro, no laptop present), see
  `docs/DISTRIBUTION.md` — an EAS `preview` build with EAS Update (OTA)
  configured lets you install once and push JS-only changes with `eas update`
  from anywhere, no dev-server connection of any kind.

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

### 4.6 `postinstall` in `apps/mobile/package.json` runs on *every* `pnpm install` — use `eas-build-post-install` instead
- **Symptom:** Vercel's web deploy fails during `pnpm install` (before `next
  build` even starts) trying to compile `packages/ui` — a package `apps/web`
  doesn't even depend on.
- **Cause:** pnpm runs each workspace package's own lifecycle scripts on
  install, not just the root's. A `postinstall` in `apps/mobile/package.json`
  (added to build `packages/{core,db,ui}` for a fresh EAS checkout, see 4.2's
  sibling problem) therefore also fires on Vercel's `pnpm install` for the
  **web** app. Building `packages/ui` (React Native JSX) in that unrelated
  context hits a real `@types/react` conflict (web pins `^18.3.0`, `packages/ui`
  pins `~19.2.17`; root `.npmrc`'s `node-linker=hoisted` can only surface one
  version at the top level) — `tsc` fails with `TS2786` (`Pressable`/`View`/
  `Text` "cannot be used as a JSX component").
- **Fix:** rename the script key to `eas-build-post-install`. This is an
  EAS-specific hook (`Hook.POST_INSTALL`, run only by EAS's Android/iOS build
  phases) — plain `npm`/`pnpm install` (Vercel, local dev) never invokes it, so
  it can't leak into unrelated builds. Local dev was never relying on this
  hook anyway (`packages/{core,db,ui}` dist/ output has always been a manual
  `npm run build` per package after changing types — this hook only ever
  targeted EAS's fresh-checkout problem).

---

## 5. EAS Update (OTA) — how a JS change actually reaches an installed build

A build made with `eas build` embeds a fixed **channel name** at compile time
(from the `eas.json` profile's `channel` field). After that, `eas update`
publishes JS/assets to a **branch**, and a **channel→branch mapping** decides
which published updates a given installed build will ever see. These are two
independent axes — profile channel and update branch — and nothing warns you
when they don't line up.

### 5.1 Two totally different distribution mechanisms — know which one is installed before troubleshooting
- A **`developmentClient: true`** build (the `development` profile) has the
  dev-launcher baked in and connects live to Metro — the `adb reverse` +
  force-stop + deep-link recipe (2.1–2.7) is how you push code to it.
- A **`preview`/`production`** build has no dev-launcher at all. It is a
  standalone binary that only ever loads code via the embedded bundle or a
  downloaded `expo-updates` OTA update. Deep-linking it into
  `exp://localhost:8081` does nothing — there's no dev-launcher listening.
- **Symptom of confusing the two:** re-tunneling/force-stopping/deep-linking a
  standalone build "succeeds" (app relaunches) but never shows new code,
  because it was never capable of connecting to Metro in the first place.
- **Check which one you have:** if `adb logcat --pid=<pid>` shows a
  `dev.expo.updates` tag doing `Updates state change: ...` on launch, it's a
  standalone/OTA build, not a dev-client.

### 5.2 Publishing to the wrong branch silently no-ops — verify the channel→branch mapping first
- **Symptom:** `eas update --branch X --environment X` reports `✔ Published!`
  with no errors, but the device's logcat shows
  `Updates state change: CheckCompleteUnavailable` /
  `UpdatesController onBackgroundUpdateFinished: No update available` — the
  app checked, got a real answer from the server, and the answer was "nothing
  new for you."
- **Cause:** the installed build's embedded channel (e.g. `preview`) doesn't
  match the branch you published to (e.g. `development`). `eas update` will
  happily publish to any branch name; it has no way to know which installed
  binaries will never ask for it.
- **Fix — check first, publish second:**
  ```bash
  eas channel:view <channel-name>   # shows which branch(es) a channel serves
  ```
  Match this against the profile the installed build actually came from
  (`apps/mobile/eas.json` → `build.<profile>.channel`), then
  `eas update --branch <that-branch>`.
- **If you don't know which profile is installed**, extract it straight from
  the APK — compiled `AndroidManifest.xml` stores strings as **UTF-16LE**, so
  plain `strings` finds nothing; you need `-el`:
  ```bash
  APK=$(adb shell pm path com.rameshv.todolist | sed 's/package://' | tr -d '\r')
  adb pull "$APK" app.apk
  unzip -o -q app.apk AndroidManifest.xml
  strings -el AndroidManifest.xml | grep -A1 UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY
  # {"expo-channel-name":"preview"}   <- ground truth, not a guess
  ```

### 5.3 A downloaded update doesn't apply until the *next* launch
- **Symptom:** `eas update` succeeds, you force-stop and relaunch the app
  once, and it still shows the old UI.
- **Cause:** `expo-updates` checks and downloads a new update in the
  background on launch, but keeps running whatever bundle is *already loaded*
  for that session. The new one only becomes active on the **following** cold
  start (`isUpdatePending=true` after `DownloadComplete`).
- **Fix:** force-stop + relaunch **twice** — once to trigger the download,
  once to apply it. Confirm via logcat (`dev.expo.updates` tag), watching the
  state sequence: `Check` → `CheckCompleteAvailable` → `Download` →
  `DownloadComplete` (`isUpdatePending=true`). The *next* `StartStartup` should
  load that update's manifest id.

### 5.4 OTA can silently apply, then crash on first native module use
- **Symptom:** the update downloads and applies cleanly (5.3's sequence
  completes fine), but the specific screen that needed the new code renders as
  a blank/grey screen instead — no crash dialog, no redbox.
- **Cause:** the new JS imports a **native** module (e.g.
  `@react-native-community/datetimepicker`) that wasn't compiled into this
  binary. OTA can only ship JS/assets — see 2.5 — so
  `TurboModuleRegistry.getEnforcing(...)` throws
  `Invariant Violation: 'RNCDatePicker' could not be found`, and React's error
  boundary swallows the crash into an empty view instead of a dialog.
- **Fix:** confirm via `adb logcat --pid=<pid> | grep -i "TurboModuleRegistry\|Invariant Violation"`
  right as you trigger the broken screen. If found, no further OTA update will
  ever fix it — you need a fresh native `eas build` for that profile, then
  reinstall the APK.

### 5.5 A long-running Metro process won't see node_modules added after it started
- **Symptom:** after `pnpm install` adds a new dependency, a Metro instance
  that was already running errors on every bundle request:
  `Unable to resolve module <pkg> ... could not be found within the project`.
- **Cause:** Metro builds its dependency/haste module map once at startup. It
  watches source file *edits*, but doesn't rescan `node_modules` for packages
  that show up after boot.
- **Fix:** kill and restart Metro (`CI=1 npx expo start --dev-client`, 2.2)
  whenever `node_modules` changes underneath a long-running instance. Verify
  with a manifest+bundle fetch before assuming the device will see anything
  new: `curl -s -H "expo-platform: android" http://localhost:8081/` for the
  manifest, then fetch its `launchAsset.url` and confirm it's real JS
  (`file <path>`), not a JSON error blob.

---

## 6. Schema / data model (bottom-up)

### 6.1 Migration files can be un-applied on the remote DB — verify LIVE, first
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
- **App won't launch / stuck connecting** → run the one-shot recovery block
  (2.7): re-tunnel + force-stop + deep-link into Metro.
- **Metro dies at boot** → `CI=1 npx expo start --dev-client` (2.2).
- **My JS fix isn't showing** → force-stop + redeploy; confirm it's not a native
  change needing a rebuild (2.4, 2.5).
- **No cable and Wi-Fi/LAN won't connect phone↔laptop at all** → tunnel mode
  (2.8): `pnpm --filter @todolist/mobile start:tunnel`, enter the printed
  `exp.direct` URL manually in the dev client. For a fully laptop-free check,
  use an EAS `preview` build + `eas update` instead (see `docs/DISTRIBUTION.md`).
- **Local Gradle/CMake hell** → align RN versions (3.1), clear caches (3.2–3.5),
  or just use EAS (3.6).
- **EAS build can't reach Supabase/PowerSync** → `eas env:push` the `.env` (4.2).
- **`eas update` succeeds but the device shows no change** → first confirm
  which distro mechanism is even installed (5.1: dev-client vs standalone
  OTA), then check the installed build's channel actually matches the branch
  you published to (5.2) — extract it straight from the APK, don't guess.
- **Update published to the right branch but device still stale after one
  relaunch** → downloaded updates apply on the *next* launch, not the current
  one — relaunch twice (5.3).
- **Update applies but a specific screen goes blank/grey with no crash
  dialog** → check logcat for `TurboModuleRegistry`/`Invariant Violation` —
  OTA can't add native modules, only a fresh `eas build` can (5.4, 2.5).
- **New dependency installed but Metro still can't resolve it** → restart
  Metro, it doesn't rescan `node_modules` after boot (5.5).
