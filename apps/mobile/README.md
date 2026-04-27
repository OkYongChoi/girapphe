# stem-brain Mobile

Expo Router app for iOS and Android. The current MVP is an offline-first study client that uses the shared knowledge graph package for practice cards, concept browsing, session progress, and notes.

## Local Development

```bash
pnpm --filter @stem-brain/mobile dev
```

Useful platform shortcuts:

```bash
pnpm --filter @stem-brain/mobile ios
pnpm --filter @stem-brain/mobile android
```

If Metro fails on Linux with `ENOSPC: System limit for number of file watchers reached`, raise the watcher limit:

```bash
sudo sysctl -w fs.inotify.max_user_watches=524288
```

## Quality Checks

```bash
pnpm --filter @stem-brain/mobile exec expo install --check
pnpm --filter @stem-brain/mobile typecheck
pnpm --filter @stem-brain/mobile build
```

`app.json` currently uses `jsEngine: "jsc"` so local export works on this aarch64 development host. If production builds run on Expo EAS or another x86_64-compatible build host, Hermes can be re-enabled and verified there.

## App Structure

- `app/_layout.tsx` wraps the app in session progress state.
- `app/(tabs)/_layout.tsx` defines the native tab shell.
- `app/(tabs)/index.tsx` shows the mobile dashboard.
- `app/(tabs)/practice.tsx` runs the recall flow.
- `app/(tabs)/graph.tsx` provides concept search and browsing.
- `app/(tabs)/saved.tsx` shows session notes and explainable cards.
- `src/data/learning.ts` adapts shared graph data into mobile practice cards.
- `src/state/progress-context.tsx` stores current in-memory session progress.

## Launch Checklist

1. Replace the placeholder app identity in `app.json` with final name, bundle ID, Android package, icon, adaptive icon, splash, and store metadata.
2. Persist progress and notes through the web API/database. The current mobile state is intentionally session-local.
3. Create Apple Developer and Google Play Console accounts.
4. Configure EAS credentials and run store builds:

```bash
pnpm dlx eas-cli build --platform ios --profile production
pnpm dlx eas-cli build --platform android --profile production
```

5. Test with TestFlight and Google Play internal testing.
6. Submit production builds:

```bash
pnpm dlx eas-cli submit --platform ios --profile production
pnpm dlx eas-cli submit --platform android --profile production
```
