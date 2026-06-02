# Admin Page — Design Document

**Date:** 2026-03-17
**Status:** Implemented (PR #63)

---

## Goal

Add an admin-only section at `/admin` for managing the knowledge graph content and monitoring users. The app previously had no admin tooling — all graph data was seeded from static files.

---

## Architecture

### Access Control

Admin identity is a single Clerk user ID stored in `ADMIN_CLERK_USER_ID` env var. The guard is applied at three independent layers:

1. **Middleware** — Clerk protects all non-public routes (users must be authenticated)
2. **Layout** — `requireAdminUser()` in `src/app/admin/layout.tsx` runs on every admin page render; non-admins are redirected to `/`
3. **Server actions** — Every action in `src/actions/admin-actions.ts` calls `requireAdminUser()` before touching the DB, so mutations are protected even if the UI guard were bypassed

`requireAdminUser()` is in `src/lib/auth.ts`:
```typescript
export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireCurrentUser();
  const adminId = process.env.ADMIN_CLERK_USER_ID;
  if (!adminId || user.id !== adminId) redirect('/');
  return user;
}
```

### Data Layer

All DB access uses the existing raw SQL pattern (`import pool from '@/lib/db'`, parameterized `pool.query()`). No Drizzle query builder — that is used only for schema generation/migrations, not at runtime.

### Rendering

All pages are Next.js Server Components with `export const dynamic = 'force-dynamic'`. Mutations use inline server actions (`action={async (formData) => { 'use server'; ... }}`). No client-side JavaScript required.

---

## Pages

### `/admin` → redirects to `/admin/nodes`

### `/admin/nodes` — Graph Node Management

Displays all `graph_nodes` rows ordered by domain, level. Provides:

- **Add form**: id (slug, auto-normalized), label, domain (select), level (0–5), difficulty (1–5), type (select)
- **Delete**: per-row form submit, cascades to edges and user knowledge states via DB `ON DELETE CASCADE`

**Node types** (constrained by DB CHECK): `concept`, `theorem`, `algorithm`, `model`

**Input sanitization**: id is trimmed, lowercased, spaces → underscores; label and domain trimmed and length-capped.

### `/admin/edges` — Graph Edge Management

Displays all `graph_edges` rows. Provides:

- **Add form**: source node (select, shows label), target node (select), type (select), weight (0–1)
- **Delete**: per-row form submit

**Edge types** (constrained by DB CHECK): `prerequisite`, `related`, `generalizes`, `derived_from`, `equivalent_to`

Node labels resolved via a `Map` built from `getAdminNodes()` — fetched concurrently with edges via `Promise.all`.

### `/admin/users` — User Overview

Read-only table showing all users who have any knowledge states recorded:

| Column | Source |
|--------|--------|
| Clerk ID | `user_knowledge_states.user_id` |
| Known | `COUNT(*) FILTER (WHERE knowledge_state = 1)` |
| Partial | `COUNT(*) FILTER (WHERE knowledge_state = 0.5)` |
| Total seen | `COUNT(*)` |
| Last active | `MAX(last_updated)` |

`knowledge_state` is a discrete enum in the DB: `{0, 0.5, 1}` — exact equality comparisons are safe.

---

## File Map

| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | `requireAdminUser()` guard |
| `src/actions/admin-actions.ts` | All admin DB queries and mutations |
| `src/app/admin/layout.tsx` | Shared layout, auth gate, nav |
| `src/app/admin/page.tsx` | Redirect to `/admin/nodes` |
| `src/app/admin/nodes/page.tsx` | Node CRUD UI |
| `src/app/admin/edges/page.tsx` | Edge CRUD UI |
| `src/app/admin/users/page.tsx` | User overview UI |

---

## Setup

Add to `.env.local`:
```
ADMIN_CLERK_USER_ID=user_xxxxxxxxxxxx
```

Find your Clerk user ID at clerk.com → Users, or log `(await getCurrentUser())?.id` temporarily.

---

## Constraints & Decisions

- **Single admin user** — sufficient for a personal app; no role system needed
- **No edit (only add/delete)** — keeps the UI simple; delete + re-add covers corrections
- **No confirmation on delete** — admin-only tool, acceptable UX tradeoff
- **Raw SQL** — matches established codebase pattern; avoids introducing Drizzle runtime
- **Server components only** — no hydration overhead for a low-traffic admin page
