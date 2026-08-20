# Tech Stack

## Runtime and Framework

- **Node.js**: runtime for local development and build scripts.
- **Next.js 16 (App Router)**: frontend and backend API routes in one project.
- **Expo / React Native**: shared mobile app target for iOS and Android.
- **React 19**: UI rendering layer for web and mobile surfaces.
- **TypeScript 5**: static typing for frontend, backend routes, mobile screens, and graph domain logic.

## Styling

- **Tailwind CSS v4**: utility-first styling system.
- **@tailwindcss/postcss**: PostCSS integration for Tailwind.
- **PostCSS**: CSS transform pipeline used by Next.js.

## Data and Persistence

- **PostgreSQL**: primary relational store for authenticated notes, billing, MCP drafts, and graph persistence.
- **Neon Serverless Postgres** with `@neondatabase/serverless`: preview and production database runtime.
- **In-memory fallback mode**: local-only fallback for public graph/practice flows when `DATABASE_URL` is intentionally absent.
- **Drizzle Kit**: schema generation and migration tooling for the web app.

## Graph & Domain Logic

- **Custom graph engine** (`packages/graph-engine/src/graph-store.ts`): node/edge querying and user knowledge state management.
- **Custom diffusion engine** (`packages/graph-engine/src/diffusion-engine.ts`): adjacency-based propagation and simplified diffusion update step.
- **Domain taxonomy** (`packages/graph-engine/src/data/graph-nodes.ts`, `packages/graph-engine/src/data/graph-edges.ts`): curated knowledge graph core.
- **Mobile adapter** (`apps/mobile/src/knowledge.ts`): mobile-specific view helpers over graph-engine data.

## Visualization

- **react-force-graph-3d**: 3D force-directed graph rendering for knowledge maps.
- **React Native views**: mobile graph discovery, practice cards, and topic detail screens.

## Deployment

- **OpenNext / Cloudflare Workers**: production and PR-preview deployment target.
- **Wrangler**: deployment/runtime tooling and Worker type generation.
- **Cloudflare Workers AI binding (`AI`)**: translation backfill runtime binding for cached public-content localization.

## Quality and Tooling

- **pnpm workspaces + Turborepo**: shared workspace scripts and package-level validation orchestration.
- **ESLint 9 + eslint-config-next**: linting and framework-aware rules.
- **TypeScript compiler (`tsc`)**: type checking.
- **Node.js test runner via `tsx --test`**: server, billing, MCP, and operational guardrail tests.
- **Playwright**: browser smoke coverage for critical user-visible routes.

## Why This Stack

- **Fast iteration**: local fallback mode keeps public practice flows usable even before wiring a full database.
- **Low migration risk**: production already runs on PostgreSQL/Neon, while public contracts still allow controlled fallback in development.
- **Visualization-ready**: force-graph integration supports immediate graph UX prototyping.
- **Scalable path**: the app can add pooling, replicas, or queued/background work without rewriting the web/mobile contracts.
