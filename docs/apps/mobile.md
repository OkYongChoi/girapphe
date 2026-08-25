# Mobile App Architecture

## Purpose

`apps/mobile` is the shared Expo application for both iOS and Android. The
platform apps should not diverge into separate product architectures unless a
native platform requirement forces it.

The mobile app should follow the same graph, card, and knowledge-state contract
as the web app. Platform-specific work should stay at the shell, navigation,
permissions, build, and device capability layers.

## Current Shape

- Framework: Expo, React Native, and Expo Router.
- Entry point: `expo-router/entry`, configured in `apps/mobile/package.json`.
- Route shell:
  - `app/_layout.tsx` defines the root stack.
  - `app/(tabs)/_layout.tsx` defines Home, Browse, and Practice tabs.
  - `app/topic/[id].tsx` renders topic detail pages.
- iOS and Android are produced from the same source tree:
  - `pnpm --filter @stem-brain/mobile ios`
  - `pnpm --filter @stem-brain/mobile android`
  - `pnpm --filter @stem-brain/mobile build`

## Shared Contracts

The mobile app's primary source of truth is `@stem-brain/graph-engine`.

Mobile imports from this package for:

- graph node and edge data
- graph and knowledge-state types
- card content
- domain color mapping
- prerequisite, dependent, and related-topic relationships

The relevant exports are centralized in `packages/graph-engine/src/index.ts`.
When a field, relationship type, or knowledge-state value changes, update the
graph engine first and then adjust app surfaces.

`@stem-brain/shared` is reserved for constants, API client types, and utilities
that are shared across web, mobile, and future app targets.

## Feature Boundaries

Mobile feature code should be organized around user flows, not platform names:

- Home: high-level map and featured topic entry points.
- Browse: searchable and filterable topic discovery.
- Practice: guest/local fallback plus authenticated, server-synced review using tri-state ratings.
- Topic detail: explanation plus prerequisite/dependent/related navigation.

Do not create separate iOS-only or Android-only versions of these flows unless
the interaction model is genuinely platform-specific.

## Data Flow

The app keeps public graph browsing and guest practice available locally, while authenticated
notes, progress, review, ranking, private graph state, and subscriptions use the deployed API:

```text
@stem-brain/graph-engine
    -> apps/mobile/src/knowledge.ts
    -> Expo Router guest/public screens

Clerk token cache (Expo SecureStore)
    -> apps/mobile/src/api.ts
    -> https://www.girapphe.com/api/mobile
    -> owner-scoped Postgres data
```

`apps/mobile/src/knowledge.ts` is the mobile adapter over graph-engine data. It
is allowed to provide mobile-specific filtering, featured-topic selection, and
view-model helpers. It should not redefine graph schema, edge semantics, or
knowledge-state rules.

## API Integration Path

The web app already exposes the server contract documented in
`docs/reference/api-spec.md`.

Mobile synchronization preserves this direction:

```text
Expo screen
    -> mobile API/client adapter
    -> documented HTTP API
    -> graph-engine-compatible response types
```

Shared request/response types should move into `@stem-brain/shared` only when they are used by
more than one app target. Keep the guest/local fallback explicit; never silently present it as
account-synced state.

## Platform Rules

- Keep product behavior shared between iOS and Android by default.
- Use Expo configuration in `apps/mobile/app.json` for platform identifiers and
  app-level capabilities.
- Put platform branches behind narrow adapters, for example push notifications,
  deep links, secure storage, camera, or haptics.
- Avoid importing web-only code from `apps/web` into mobile. Shared logic should
  move into `packages/*`.

## Documentation Ownership

Use these documents together:

- `docs/architecture/overview.md`: product and system architecture.
- `docs/reference/data-model.md`: canonical data model.
- `docs/reference/api-spec.md`: HTTP API contract.
- `docs/reference/knowledge-graph-spec.md`: graph semantics and governance.
- `docs/apps/mobile.md`: mobile app architecture and platform guidance.

If mobile behavior differs from the shared architecture, document the reason in
this file and keep the implementation scoped to `apps/mobile` or a shared
package with an explicit contract.
