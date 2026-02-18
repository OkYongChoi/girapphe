# Tech Stack

## Runtime and Framework

- **Node.js**: runtime for local development and build scripts.
- **Next.js 16 (App Router)**: frontend and backend API routes in one project.
- **React 19**: UI rendering layer.
- **TypeScript 5**: static typing for frontend, backend routes, and graph domain logic.

## Styling

- **Tailwind CSS v4**: utility-first styling system.
- **@tailwindcss/postcss**: PostCSS integration for Tailwind.
- **PostCSS**: CSS transform pipeline used by Next.js.

## Data and Persistence

- **PostgreSQL** (target): primary relational store for users, graph nodes/edges, and user knowledge states.
- **Neon Serverless driver (@neondatabase/serverless)**: Postgres connectivity in serverless-friendly environments.
- **In-memory graph store (current MVP mode)**: fast local iteration with migration path to Postgres.

## Graph & Domain Logic

- **Custom graph engine** (`src/lib/graph-store.ts`): node/edge querying and user knowledge state management.
- **Custom diffusion engine** (`src/lib/diffusion-engine.ts`): adjacency-based propagation and simplified diffusion update step.
- **Domain taxonomy** (`src/data/graph-nodes.ts`, `src/data/graph-edges.ts`): curated AI/CS knowledge graph core.

## Visualization

- **react-force-graph-3d**: 3D force-directed graph rendering for knowledge maps.

## Deployment

- **OpenNext / Cloudflare Workers**: edge-oriented deployment target.
- **Wrangler**: deployment/runtime tooling for Cloudflare.

## Quality and Tooling

- **ESLint 9 + eslint-config-next**: linting and framework-aware rules.
- **TypeScript compiler (`tsc`)**: type checking.
- **npm scripts**: unified developer workflow (`dev`, `build`, `lint`, etc.).

## Why This Stack

- **Fast iteration**: Next.js + TypeScript + in-memory graph enables rapid product iteration.
- **Low migration risk**: schema and graph contracts are already aligned with PostgreSQL.
- **Visualization-ready**: force-graph integration supports immediate graph UX prototyping.
- **Scalable path**: architecture can evolve from local memory to DB-backed graph services without rewriting frontend contracts.
