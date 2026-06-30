# Distribution & Accounts Model

How this app is built, shipped, and how end users get accounts. Read this before
onboarding testers or planning a public release.

## Two kinds of accounts (don't conflate them)

| Account type | Who needs it | How many | What it is |
|---|---|---|---|
| **Developer / infra accounts** | Only the maintainer | One each, total | Expo/EAS, the Supabase project, the PowerSync instance |
| **App user account** | Each end user | One per person | An email/password row in *our* Supabase Auth, created from inside the app |

**End users never create Supabase, PowerSync, or Expo accounts.** They install the
app, tap "Sign Up" in the app, and that creates a user *in our single Supabase
project*. All their data flows through the one shared backend. This is already
multi-tenant by design: Postgres RLS (`WHERE user_id = auth.user_id()`) and the
PowerSync sync rules guarantee each user only ever sees their own rows. See the
Security section in the root `CLAUDE.md`.

So there is exactly **one** Supabase project, **one** PowerSync instance, and
**one** Expo/EAS account — all owned by the maintainer. Everyone else just signs
up inside the app.

## What EAS / expo.dev is for

A developer build service — end users never touch it. It provides:

- **Cloud builds** — compiles the native APK/IPA without a perfect local
  Android/Xcode toolchain (the supported path for this pnpm monorepo; local
  `expo run:android` hits Gradle/CMake codegen issues).
- **Credentials** — manages the Android keystore / iOS signing certs.
- **EAS Update (OTA)** — push JS-only changes to installed apps without a new
  store release.
- **EAS Submit** — uploads to Google Play / App Store.
- **Env vars & build profiles** — configured in `apps/mobile/eas.json`.

EAS project: `@ramsmail/todolist` (`projectId` + `owner` are committed in
`apps/mobile/app.json`).

## Build profiles (`apps/mobile/eas.json`)

| Profile | Output | Use |
|---|---|---|
| `development` | Dev client APK (`developmentClient: true`) | Maintainer's daily driver; connects to a local Metro server (`expo start --dev-client`), has debugging. Requires a laptop running Metro. |
| `preview` | Standalone internal APK | Hand to testers / friends. Runs on its own — no Metro, no laptop. This is what you share before a store release. |
| `production` | AAB, auto-incrementing version | Store submission. |

Build env vars come from the matching EAS environment (e.g. the `development`
environment holds the `EXPO_PUBLIC_*` Supabase/PowerSync values). Push them with
`eas env:push <environment> --path .env`; they are not read from the gitignored
local `.env` during a cloud build.

## How people actually get the app

| Path | Cost | Best for |
|---|---|---|
| Send the **`preview` APK** directly | Free | Friends, testers, a small group |
| **Google Play Store** | $25 one-time | Public Android release |
| **Apple App Store / TestFlight** | $99/yr | iOS (deferred — see Phase 5 in the share-capture plan) |

### Sharing a build with a tester (quick path)
```bash
cd apps/mobile
npx eas-cli build --profile preview --platform android
```
EAS returns an install URL / QR code. The tester opens it on their Android
device, installs the APK, launches the app, and signs up with email/password.
Nothing else required on their end.

## What a new user's first run looks like
1. Install the app (APK link, or from the store).
2. Tap **Sign Up**, enter email + password.
3. Supabase Auth creates the user; PowerSync begins syncing *only their* rows.
4. They start capturing tasks. No backend accounts, no configuration.
