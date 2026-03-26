# Admin Operations

The `/admin` routes are intended for a single trusted Clerk user and operate only on the
PostgreSQL-backed graph tables in `apps/web`.

## Required Environment Variables

Set these before using `/admin`:

```bash
DATABASE_URL=postgres://user:password@host/db?sslmode=require
ADMIN_CLERK_USER_ID=user_...
```

- `DATABASE_URL` is required because the admin pages read and write `graph_nodes`,
  `graph_edges`, and `user_knowledge_states` directly.
- `ADMIN_CLERK_USER_ID` must match the Clerk user id for the only account allowed to access
  `/admin`.

Use the web app templates as your source of truth:

- `apps/web/.env.dev.example`
- `apps/web/.env.prod.example`

## Route Behavior

- Signed-out users are redirected to `/login`.
- Signed-in non-admin users are redirected to `/`.
- `/admin` redirects to `/admin/nodes`.
- All mutations re-check admin authorization in the server action before executing.

## Supported Operations

- Nodes: list, create, delete
- Edges: list, create, delete
- Users: view aggregated learning progress

## Validation Rules

- Node ids are normalized to lowercase with spaces converted to underscores.
- Node `level` must be between `0` and `5`.
- Node `difficulty` must be between `1` and `5`.
- Edge `weight` must be between `0` and `1`.
- Edge source and target must be different nodes.

## Verification

1. Add your Clerk user id to `ADMIN_CLERK_USER_ID`.
2. Start the web app with a valid `DATABASE_URL`.
3. Visit `/admin/nodes` and verify existing rows load.
4. Create and delete a node.
5. Create and delete an edge.
6. Visit `/admin/users` and verify user aggregates render.
