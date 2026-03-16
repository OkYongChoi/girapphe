# Admin Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/admin` section with three tabs — Nodes, Edges, Users — protected to the admin Clerk user ID via an env var.

**Architecture:** Server components for all pages, server actions for all DB mutations using raw SQL (matching the established codebase pattern via `pool.query()`), admin identity checked by `requireAdminUser()` in a shared layout.

**Tech Stack:** Next.js 16 App Router, Clerk auth (`@clerk/nextjs`), `@neondatabase/serverless` raw SQL, Tailwind CSS 4, TypeScript

---

## Chunk 1: Admin guard + server actions

### Task 1: Add `requireAdminUser()` to auth helpers

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Add `requireAdminUser` below `requireCurrentUser`**

```typescript
export async function requireAdminUser(): Promise<AuthUser> {
  const user = await requireCurrentUser();
  const adminId = process.env.ADMIN_CLERK_USER_ID;
  if (!adminId || user.id !== adminId) redirect('/');
  return user;
}
```

`redirect` is already imported in this file. No new imports needed.

- [ ] **Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(admin): add requireAdminUser auth guard"
```

---

### Task 2: Create admin server actions

**Files:**
- Create: `src/actions/admin-actions.ts`

The codebase uses raw SQL via `import pool from '@/lib/db'` and `pool.query(sql, [params])`. Do NOT use the Drizzle query builder — there is no Drizzle runtime instance in this project.

- [ ] **Step 1: Create `src/actions/admin-actions.ts`**

```typescript
'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdminUser } from '@/lib/auth';

// ── Types ────────────────────────────────────────────────────────────────────

export type AdminNode = {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: string;
  created_at: string;
};

export type AdminEdge = {
  id: number;
  source: string;
  target: string;
  type: string;
  weight: number;
};

export type AdminUser = {
  user_id: string;
  known: number;
  partial: number;
  total: number;
  last_updated: string | null;
};

// ── Nodes ────────────────────────────────────────────────────────────────────

export async function getAdminNodes(): Promise<AdminNode[]> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return [];
  const { rows } = await pool.query<AdminNode>(
    'SELECT id, label, domain, level, difficulty, type, created_at FROM graph_nodes ORDER BY domain, level'
  );
  return rows;
}

export async function createAdminNode(data: {
  id: string;
  label: string;
  domain: string;
  level: number;
  difficulty: number;
  type: string;
}): Promise<void> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return;

  const id = data.id.trim().toLowerCase().replace(/\s+/g, '_');
  const label = data.label.trim().slice(0, 200);
  const domain = data.domain.trim().slice(0, 50);
  if (!id || !label || !domain) throw new Error('id, label, and domain are required');

  await pool.query(
    `INSERT INTO graph_nodes (id, label, domain, level, difficulty, type)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, label, domain, data.level, data.difficulty, data.type]
  );
  revalidatePath('/admin/nodes');
}

export async function deleteAdminNode(id: string): Promise<void> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return;
  await pool.query('DELETE FROM graph_nodes WHERE id = $1', [id]);
  revalidatePath('/admin/nodes');
}

// ── Edges ────────────────────────────────────────────────────────────────────

export async function getAdminEdges(): Promise<AdminEdge[]> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return [];
  const { rows } = await pool.query<AdminEdge>(
    'SELECT id, source, target, type, weight FROM graph_edges ORDER BY source, target'
  );
  return rows;
}

export async function createAdminEdge(data: {
  source: string;
  target: string;
  type: string;
  weight: number;
}): Promise<void> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return;
  if (!data.source || !data.target || !data.type) throw new Error('source, target, and type are required');

  await pool.query(
    `INSERT INTO graph_edges (source, target, type, weight) VALUES ($1, $2, $3, $4)`,
    [data.source, data.target, data.type, data.weight]
  );
  revalidatePath('/admin/edges');
}

export async function deleteAdminEdge(id: number): Promise<void> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return;
  await pool.query('DELETE FROM graph_edges WHERE id = $1', [id]);
  revalidatePath('/admin/edges');
}

// ── Users ────────────────────────────────────────────────────────────────────

export async function getAdminUsers(): Promise<AdminUser[]> {
  await requireAdminUser();
  if (!process.env.DATABASE_URL) return [];
  const { rows } = await pool.query<AdminUser>(
    `SELECT
       user_id,
       COUNT(*)::int                                             AS total,
       COUNT(*) FILTER (WHERE knowledge_state = 1)::int         AS known,
       COUNT(*) FILTER (WHERE knowledge_state = 0.5)::int       AS partial,
       MAX(last_updated)                                         AS last_updated
     FROM user_knowledge_states
     GROUP BY user_id
     ORDER BY MAX(last_updated) DESC NULLS LAST`
  );
  return rows;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/admin-actions.ts
git commit -m "feat(admin): add admin server actions using raw SQL"
```

---

## Chunk 2: Admin layout + pages

### Task 3: Admin layout with nav tabs

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/app/admin/layout.tsx`**

```typescript
import { requireAdminUser } from '@/lib/auth';
import Link from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center gap-6">
          <span className="font-semibold text-sm text-gray-400 uppercase tracking-widest">
            Admin
          </span>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/nodes" className="text-gray-400 hover:text-white transition-colors">
              Nodes
            </Link>
            <Link href="/admin/edges" className="text-gray-400 hover:text-white transition-colors">
              Edges
            </Link>
            <Link href="/admin/users" className="text-gray-400 hover:text-white transition-colors">
              Users
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/page.tsx`**

```typescript
import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/admin/nodes');
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat(admin): add admin layout with nav tabs"
```

---

### Task 4: Nodes management page

**Files:**
- Create: `src/app/admin/nodes/page.tsx`

- [ ] **Step 1: Create `src/app/admin/nodes/page.tsx`**

Note: inline `'use server'` functions inside `action={}` props require each function to be defined inline in a Server Component file. This is valid Next.js 16 syntax.

```typescript
import { getAdminNodes, createAdminNode, deleteAdminNode } from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

const NODE_TYPES = ['concept', 'theorem', 'algorithm', 'model'];
const DOMAINS = ['ml', 'dl', 'nlp', 'cv', 'rl', 'math', 'stats', 'systems', 'general', 'signal'];

export default async function AdminNodesPage() {
  const nodes = await getAdminNodes();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Graph Nodes</h1>
        <p className="text-sm text-gray-400">{nodes.length} nodes total</p>
      </div>

      {/* Add node form */}
      <form
        action={async (formData: FormData) => {
          'use server';
          await createAdminNode({
            id: formData.get('id') as string,
            label: formData.get('label') as string,
            domain: formData.get('domain') as string,
            level: Number(formData.get('level')),
            difficulty: Number(formData.get('difficulty')),
            type: formData.get('type') as string,
          });
        }}
        className="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 p-4 md:grid-cols-3"
      >
        <h2 className="col-span-full text-sm font-medium text-gray-300">Add Node</h2>
        <input
          name="id"
          placeholder="id (slug)"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <input
          name="label"
          placeholder="label"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <select
          name="domain"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
        >
          {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input
          name="level"
          type="number"
          placeholder="level (0-5)"
          defaultValue="1"
          min="0"
          max="5"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <input
          name="difficulty"
          type="number"
          placeholder="difficulty (1-5)"
          defaultValue="2"
          min="1"
          max="5"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <select
          name="type"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
        >
          {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          type="submit"
          className="col-span-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Add Node
        </button>
      </form>

      {/* Nodes table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-4">ID</th>
              <th className="pb-2 pr-4">Label</th>
              <th className="pb-2 pr-4">Domain</th>
              <th className="pb-2 pr-4">Level</th>
              <th className="pb-2 pr-4">Diff</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{node.id}</td>
                <td className="py-2 pr-4">{node.label}</td>
                <td className="py-2 pr-4 text-gray-400">{node.domain}</td>
                <td className="py-2 pr-4 text-gray-400">{node.level}</td>
                <td className="py-2 pr-4 text-gray-400">{node.difficulty}</td>
                <td className="py-2 pr-4 text-gray-400">{node.type}</td>
                <td className="py-2">
                  <form
                    action={async () => {
                      'use server';
                      await deleteAdminNode(node.id);
                    }}
                  >
                    <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/nodes/page.tsx
git commit -m "feat(admin): add nodes management page"
```

---

### Task 5: Edges management page

**Files:**
- Create: `src/app/admin/edges/page.tsx`

- [ ] **Step 1: Create `src/app/admin/edges/page.tsx`**

```typescript
import {
  getAdminEdges,
  getAdminNodes,
  createAdminEdge,
  deleteAdminEdge,
} from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

const EDGE_TYPES = ['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'];

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none';

export default async function AdminEdgesPage() {
  const [edges, nodes] = await Promise.all([getAdminEdges(), getAdminNodes()]);
  const nodeMap = new Map(nodes.map((n) => [n.id, n.label]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Graph Edges</h1>
        <p className="text-sm text-gray-400">{edges.length} edges total</p>
      </div>

      {/* Add edge form */}
      <form
        action={async (formData: FormData) => {
          'use server';
          await createAdminEdge({
            source: formData.get('source') as string,
            target: formData.get('target') as string,
            type: formData.get('type') as string,
            weight: Number(formData.get('weight')),
          });
        }}
        className="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 p-4 md:grid-cols-4"
      >
        <h2 className="col-span-full text-sm font-medium text-gray-300">Add Edge</h2>
        <select name="source" required className={inputCls}>
          <option value="">source node…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>
        <select name="target" required className={inputCls}>
          <option value="">target node…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>
        <select name="type" required className={inputCls}>
          {EDGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          name="weight"
          type="number"
          step="0.1"
          placeholder="weight"
          defaultValue="1"
          min="0"
          max="1"
          required
          className={inputCls}
        />
        <button
          type="submit"
          className="col-span-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Add Edge
        </button>
      </form>

      {/* Edges table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-4">ID</th>
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4">Target</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Weight</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {edges.map((edge) => (
              <tr key={edge.id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{edge.id}</td>
                <td className="py-2 pr-4">{nodeMap.get(edge.source) ?? edge.source}</td>
                <td className="py-2 pr-4">{nodeMap.get(edge.target) ?? edge.target}</td>
                <td className="py-2 pr-4 text-gray-400">{edge.type}</td>
                <td className="py-2 pr-4 text-gray-400">{edge.weight}</td>
                <td className="py-2">
                  <form
                    action={async () => {
                      'use server';
                      await deleteAdminEdge(edge.id);
                    }}
                  >
                    <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/edges/page.tsx
git commit -m "feat(admin): add edges management page"
```

---

### Task 6: Users overview page

**Files:**
- Create: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Create `src/app/admin/users/page.tsx`**

```typescript
import { getAdminUsers } from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Users</h1>
        <p className="text-sm text-gray-400">{users.length} active users</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-4">Clerk ID</th>
              <th className="pb-2 pr-4">Known</th>
              <th className="pb-2 pr-4">Partial</th>
              <th className="pb-2 pr-4">Total seen</th>
              <th className="pb-2">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {users.map((u) => (
              <tr key={u.user_id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{u.user_id}</td>
                <td className="py-2 pr-4 text-green-400">{u.known}</td>
                <td className="py-2 pr-4 text-yellow-400">{u.partial}</td>
                <td className="py-2 pr-4 text-gray-400">{u.total}</td>
                <td className="py-2 text-xs text-gray-400">
                  {u.last_updated ? new Date(u.last_updated).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/users/page.tsx
git commit -m "feat(admin): add users overview page"
```

---

## Chunk 3: Env setup + smoke test

### Task 7: Add ADMIN_CLERK_USER_ID to env

- [ ] **Step 1: Add to `.env.local`**

```bash
echo "ADMIN_CLERK_USER_ID=your_clerk_user_id_here" >> .env.local
```

Replace `your_clerk_user_id_here` with your actual Clerk user ID. Find it at clerk.com → Users, or by temporarily logging `(await getCurrentUser())?.id` in any server action.

- [ ] **Step 2: Verify the page loads**

Start dev server:
```bash
npm run dev
```

- Sign in, then visit `http://localhost:3000/admin`
- Expected: redirects to `/admin/nodes`, shows nodes table
- Expected with wrong user or no env var: redirects to `/`

- [ ] **Step 3: Commit env example**

```bash
echo "ADMIN_CLERK_USER_ID=" >> .env.example
git add .env.example
git commit -m "docs: add ADMIN_CLERK_USER_ID to env example"
```

---

## Summary

| File | Action |
|------|--------|
| `src/lib/auth.ts` | Add `requireAdminUser()` using `ADMIN_CLERK_USER_ID` env var |
| `src/actions/admin-actions.ts` | Create — raw SQL actions for nodes, edges, users |
| `src/app/admin/layout.tsx` | Create — auth guard + nav (Nodes / Edges / Users) |
| `src/app/admin/page.tsx` | Create — redirect to /admin/nodes |
| `src/app/admin/nodes/page.tsx` | Create — nodes table + add/delete form |
| `src/app/admin/edges/page.tsx` | Create — edges table + add/delete form |
| `src/app/admin/users/page.tsx` | Create — users overview (known/partial/total) |
| `.env.local` | Add `ADMIN_CLERK_USER_ID` (not committed) |

**Key decisions:**
- Raw SQL via `pool.query()` — matches established codebase pattern, no Drizzle runtime needed
- All Tailwind classes inlined — no `@apply`, consistent with rest of codebase
- Float range checks (`>= 0.9` for known, `0.4–0.9` for partial) — avoids `real` column precision issues
- `DATABASE_URL` guard in every action — matches pattern in existing actions
