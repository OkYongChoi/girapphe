# Girapphe mobile store release

This checklist separates source readiness from external activation. A passing local export does
not prove that Apple, Google, Clerk, RevenueCat, AdMob, or EAS is configured.

## Source gates

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @stem-brain/mobile release:doctor
pnpm --filter @stem-brain/mobile check
pnpm --filter @stem-brain/mobile build
pnpm harness:deploy
git diff --check
```

`release:check` validates the Girapphe app name and identifiers, 1024 px icons, splash size,
production fail-closed configuration, iOS privacy manifest, and store build/version policy.
On ARM64 Linux only, the local export gate validates Metro output without Hermes bytecode because
Expo SDK 57 ships an x86-64 Linux compiler; x86-64 CI and EAS production builds retain Hermes.
After the Expo owner links the project with `pnpm --filter @stem-brain/mobile eas:init`, run
`release:check:linked` and commit only the generated `extra.eas.projectId`.

## Immutable choices to confirm before the first upload

- App display name and store title: `Girapphe`.
- Expo slug and URL scheme: `girapphe`.
- iOS bundle identifier: `com.girapphe.app`.
- Android application ID: `com.girapphe.app`.
- iPhone-only first release (`supportsTablet: false`). Enable iPad only after iPad QA and screenshots.

Package and bundle identifiers cannot be casually changed after store registration. If either
identifier has already been reserved under a different value, update source before the first build.

## External activation

1. Create or verify the Expo, Apple Developer/App Store Connect, and Google Play Console accounts.
2. Run `eas:init`, then configure all public production values named in `apps/mobile/.env.example`
   in the EAS `production` Environment. Do not place server secrets in `EXPO_PUBLIC_*` variables.
3. Create the exact iOS and Android apps in Clerk, RevenueCat, AdMob, and both stores. Test the same
   Clerk account on web and mobile.
4. Publish final Terms, Privacy, Support, and account-deletion pages. Have qualified counsel review
   the repository's initial legal copy and activate `support@girapphe.com` and `privacy@girapphe.com`.
5. Complete App Store privacy answers and Google Play Data safety from observed SDK/runtime behavior.
   The app uses Clerk auth, private synced content, RevenueCat/store purchases, and consent-gated,
   non-personalized Google Native Ads. Do not mark data as uncollected solely because Girapphe does
   not read full card numbers.
6. In Play Console, set the account-deletion URL to
   `https://www.girapphe.com/account/delete` and declare that the app contains ads.
7. In App Store Connect, add the subscription products, review notes, a working review account,
   privacy URL, support URL, age rating, category, export-compliance answer, and screenshots.
8. In Google Play, add equivalent listing copy, screenshots, content rating, ads declaration,
   Data safety, app access credentials, and subscription products. The first Android upload may
   need to be created manually in Play Console before API-based submission is enabled.
9. Publish and test a Google-certified UMP consent message. Register `app-ads.txt` for the final
   developer domain before enabling production ad units.
10. Use physical iOS and Android devices with sandbox/license-test accounts to verify sign-up,
    session persistence, note CRUD/trash/restore, practice sync, purchase, restore, cancellation,
    ad consent, ad-free removal, account switching, and account deletion.

## Build and submission

After the source gates, project linkage, EAS production values, and physical-device acceptance pass:

```bash
pnpm --filter @stem-brain/mobile eas:production
pnpm --filter @stem-brain/mobile eas:submit:ios
pnpm --filter @stem-brain/mobile eas:submit:android
pnpm --filter @stem-brain/mobile eas:metadata:push
```

EAS build success means signed binaries exist; it does not mean store review or rollout completed.
Record the exact build IDs, store processing status, review result, and phased/production rollout.
