# Mobile authentication, subscriptions, and sponsored cards

Development and preview builds keep practice usable when account or purchase services are not
configured: Clerk and RevenueCat activate only with their public keys. Independently, every
non-production build automatically uses Google's sample app IDs and a NativeAd test unit so the
advertising path is safe to exercise without live AdMob values. Production builds fail closed
until the release configuration is complete. Production values belong in EAS Environments; do
not commit a filled `.env` file.

## Native development build

RevenueCat and Google Mobile Ads contain native code. Install the declared dependencies,
then create a fresh development build instead of relying on hot reload of an older binary:

```bash
pnpm install
pnpm --filter @stem-brain/mobile eas:login
pnpm --filter @stem-brain/mobile eas:init
pnpm --filter @stem-brain/mobile eas:ios:development
pnpm --filter @stem-brain/mobile eas:android:development
```

Run `eas:init` once with the Expo account that owns the app and commit only the generated
non-secret EAS project linkage. Configure values in the named EAS Environments before builds;
do not answer an unexpected interactive project-creation prompt in release automation.

RevenueCat can expose a limited Preview API mode in Expo Go, but real StoreKit/Google Play
purchases and Google NativeAd rendering require an EAS development or preview build. Both
non-production EAS profiles use Google's sample app IDs and `TestIds.NATIVE`; only the
production profile can select real unit IDs.

## EAS Environment variables

Configure these public build values in the `development`, `preview`, and `production` EAS
Environments as appropriate. They are identifiers or public SDK keys, not server secrets.
The production config fails closed unless the canonical API origin, live Clerk key, both
RevenueCat platform keys, both AdMob app/unit IDs, and final legal URLs are present and valid.

| Name | Required for | Notes |
|---|---|---|
| `EXPO_PUBLIC_APP_BASE_URL` | Authenticated entitlement API and account links | Production is pinned to `https://www.girapphe.com` because the app sends its Clerk bearer token only to this origin. |
| `EXPO_PUBLIC_TERMS_URL` | Store subscription paywall | Public, final Terms of Use HTTPS URL; required for production builds. |
| `EXPO_PUBLIC_PRIVACY_URL` | Store subscription paywall | Public, final Privacy Policy HTTPS URL; required for production builds. |
| `EXPO_PUBLIC_SUPPORT_URL` | Account support | Canonical public support page; production is pinned to `https://www.girapphe.com/support`. |
| `EXPO_PUBLIC_ACCOUNT_DELETION_URL` | Store deletion disclosure and fallback | Direct verified web deletion path; production is pinned to `https://www.girapphe.com/account/delete`. |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Sign-in and account linking | Use the matching Clerk test/live instance for the EAS environment. |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | iOS purchases | RevenueCat public Apple SDK key. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Android purchases | RevenueCat public Google SDK key. |
| `EXPO_PUBLIC_REVENUECAT_MONTHLY_PACKAGE_ID` | Monthly plan | Defaults to `$rc_monthly`. |
| `EXPO_PUBLIC_REVENUECAT_ANNUAL_PACKAGE_ID` | Annual plan | Defaults to `$rc_annual`. |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | Production iOS native build | AdMob app ID, containing `~`. |
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | Production Android native build | AdMob app ID, containing `~`. |
| `EXPO_PUBLIC_ADMOB_IOS_NATIVE_UNIT_ID` | Production iOS NativeAd | Native advanced ad unit ID, containing `/`. |
| `EXPO_PUBLIC_ADMOB_ANDROID_NATIVE_UNIT_ID` | Production Android NativeAd | Native advanced ad unit ID, containing `/`. |

`app.config.ts` uses Google's sample app IDs and test NativeAd unit outside the EAS
`production` profile, and fails a production build when either production app ID is missing,
avoiding an invalid native SDK binary. A production build never substitutes a test unit ID;
native app measurement is delayed until the consent-gated first ad request, and a runtime
consent, request, or load failure shows the non-blocking Girapphe house/upgrade card.

## Clerk

1. Enable the desired email/password sign-in policy in Clerk.
2. Put the environment's publishable key in EAS.
3. Confirm the same Clerk user ID is used by the web account and mobile account.
4. Test session persistence after terminating and reopening the app. Clerk's token cache uses
   Expo SecureStore and is omitted entirely when the publishable key is absent.
5. Test Account → Delete account with a disposable user. Private product data and the Clerk
   user must disappear, and the same credentials must no longer sign in. Keep the web deletion
   URL functional for users who no longer have the app installed.

Purchases are intentionally unavailable before sign-in. The app passes the Clerk `userId`
as RevenueCat's App User ID; it never uses an email address or a hard-coded shared identifier.

## RevenueCat and stores

1. Add the App Store Connect and Google Play apps to one RevenueCat project.
2. Create an entitlement whose exact identifier is `ad_free`.
3. Create monthly and annual auto-renewing products in App Store Connect and Google Play.
4. Attach them to the current RevenueCat Offering as `$rc_monthly` and `$rc_annual`, or set
   the two package-ID environment variables to custom identifiers.
   Configure the exact underlying monthly and annual store product IDs on the web backend as
   comma-separated `REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS` and
   `REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS`; package IDs and store product IDs are different
   RevenueCat concepts, and the lists may contain both iOS and Android IDs.
5. Connect RevenueCat to each store with the required App Store in-app-purchase credentials
   and Google Play service credentials, then verify platform server notifications/RTDN so
   renewals, refunds, and expirations reach RevenueCat promptly.
6. Configure subscription terms, tax, agreements, banking, screenshots, and review metadata
   in each store. Do not add a store introductory trial if one strictly Clerk-wide trial is
   required: Apple/Google eligibility is tied to the store account and cannot be revoked by a
   prior Stripe/Toss trial. If you intentionally enable a store trial, document it as a
   platform-specific offer. The app displays the localized store price rather than hard-coding
   a currency amount.
7. Test purchase, renewal, expiration, account switching, management/cancellation, and
   **Restore purchases** with
   sandbox/license-test accounts on physical devices.

Mobile removes ads when either RevenueCat `CustomerInfo.entitlements.active.ad_free` or the
authenticated provider-neutral server endpoint reports `ad_free`. This makes web Stripe/Toss
and store purchases converge on the same Clerk account. A purchase sheet closing, redirect,
or client assertion alone never grants ad-free status. Immediately before opening a store
purchase sheet, the app rechecks the server entitlement and aborts the purchase if that check
fails or if another provider has already granted ad-free access.

## AdMob and policy

1. Register the exact iOS bundle ID and Android package from `app.json` in AdMob.
2. Create a Native advanced unit for each platform and configure the four production IDs.
3. In Google Play Console, declare that the app contains ads.
4. Publish a Google-certified UMP message and complete privacy disclosures, app-ads.txt,
   age/content settings, and applicable consent flows before production traffic. The app runs
   `AdsConsent.gatherConsent()` and checks `canRequestAds` before SDK initialization or any
   NativeAd request. Non-personalized ads still require applicable consent; do not activate
   production ad units until the message has been tested in regulated and non-regulated regions.
5. Keep room for the SDK-provided AdChoices overlay. Do not add a custom AdChoices view,
   custom click gesture, or Pressable wrapper around Google ad assets.

The NativeAd is destroyed whenever its sponsored card unmounts. Headline, advertiser, body,
icon, and call-to-action views are registered through `NativeAsset`; the SDK owns impressions
and clicks. `Sponsored` attribution is always visible.

## Acceptance checks

- With no external configuration, the app starts and practice remains usable.
- Signed-out users can practice but must sign in before purchasing or restoring.
- Rate or skip exactly five cards: one sponsored/house card appears after advance 5, 10, 15,
  and so on. Revealing an answer or opening a topic does not increment the counter.
- Continue from the sponsored card without losing the next learning card.
- Activate `ad_free`: any visible ad card unmounts and later advances issue no NativeAd request.
- Switch Clerk accounts and verify RevenueCat uses the newly signed-in Clerk user ID.
- Restore on both store platforms and confirm `ad_free` updates without restarting the app.
- Delete a disposable signed-in account from iOS and Android, then repeat from the direct web
  deletion page. Confirm notes, drafts, progress, tokens, and Clerk identity are removed.
- Run `pnpm --filter @stem-brain/mobile check` and both platform export/build checks after
  installing dependencies and regenerating the workspace lockfile in the owning release task.
