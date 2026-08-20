# Architecture Consulting Review (August 2026)

## Executive assessment

Girapphe is a **well-shaped modular monolith** for its current product stage. The
Next.js application owns the HTTP boundary and deployment unit, Expo is a separate
client, and framework-independent graph logic is already isolated in a workspace
package. That is a better fit than introducing services, queues, or a second backend
before traffic and team boundaries justify their operational cost.

The next architecture investment should therefore be **stronger internal
boundaries**, not service extraction. In particular, the web application currently
mixes transport, application orchestration, persistence, and product policy in a few
large modules. This increases regression risk as billing, localization, mobile, MCP,
and knowledge ingestion continue to grow inside the same Worker.

### Recommendation at a glance

| Priority | Decision | Why now |
| --- | --- | --- |
| P0 | Keep the modular monolith and single Worker | The deployment topology is simple and the domain does not yet require distributed coordination. |
| P0 | Introduce application services between routes/actions and persistence | Web routes and mobile transport currently reuse server actions and large database modules directly. |
| P0 | Make database behavior explicit per capability | The public fallback is useful, but implicit `DATABASE_URL` branching makes behavior harder to reason about and test. |
| P1 | Split the mobile endpoint by resource and define shared wire schemas | One multiplexed route concentrates authorization, parsing, dispatch, and response construction. |
| P1 | Establish schema and migration ownership | Drizzle schema, migrations, and the bootstrap SQL must have a documented source of truth and drift check. |
| P1 | Add architecture-focused contract and boundary tests | Current checks are strong, but package direction and API compatibility are not enforced. |
| P2 | Move background work only when request latency or reliability demands it | Translation, cleanup, reconciliation, and ingestion are candidates; service extraction is not a prerequisite. |

## Scope and method

This is a repository-level static review of the web, mobile, shared packages,
persistence definitions, deployment configuration, documentation, and validation
commands. It is not a production performance audit: no traffic profile, database
query plan, Cloudflare trace, incident history, or cost data was available. Capacity
decisions should be validated against those inputs before implementation.

## Current-state model

```text
Browser               Expo client                 MCP client
   |                       |                           |
   +-----------------------+---------------------------+
                           |
              Next.js App Router / Server Actions
              (single Cloudflare Worker deployment)
                           |
          +----------------+----------------+
          |                |                |
     Clerk auth      application code   billing providers
                           |
                    Neon PostgreSQL

Web + Mobile
     |
     +--> @stem-brain/shared (locale/taxonomy contracts)
     +--> @stem-brain/graph-engine (graph model, static data, diffusion)
```

### Healthy properties to preserve

1. **One deployable backend.** Operational complexity remains proportional to the
   team and product rather than to the number of product capabilities.
2. **Framework-independent domain package.** `@stem-brain/graph-engine` is consumed
   by both web and mobile and does not depend on either UI framework.
3. **Source-controlled taxonomy.** Static graph data has a clear review path and can
   be synchronized to persistent environments deliberately.
4. **Explicit authentication edge.** Clerk identity is resolved at the server edge;
   private and admin capabilities require database-backed operation.
5. **Deployment-aware validation.** The harness covers lint, types, server tests,
   environment templates, builds, and Worker size rather than treating compilation
   alone as release confidence.

## Findings and advice

### 1. Application boundaries are implicit (P0)

The web application has route handlers, server actions, and `lib` modules, but those
folders are technical groupings rather than enforced capability boundaries. The
mobile API imports server actions directly, while graph actions issue SQL directly
for some use cases and delegate to `knowledge-graph-db` for others. Large files such
as card actions, knowledge ingestion, and Toss subscriptions consequently combine
multiple reasons to change.

**Risk:** authorization or transaction behavior can diverge by entry point, business
logic becomes difficult to test without framework context, and changes to one
transport can unexpectedly affect another.

**Advice:** add a thin application layer organized by capability, for example:

```text
apps/web/src/modules/
  graph/
    application/submit-quiz.ts
    application/get-graph.ts
    domain/errors.ts
    infrastructure/graph-repository.ts
  cards/
  ingestion/
  billing/
```

Routes and server actions should do only four things: authenticate, validate the
wire input, invoke an application use case, and translate the result to the
transport. Application services should receive an actor and dependencies explicitly;
they should not import Next.js request APIs. Repositories should own SQL and
transaction boundaries. Migrate one vertical slice at a time—`submit quiz` is a good
first slice—and avoid a repository-wide rewrite.

### 2. Runtime modes are useful but implicit (P0)

Graph reads fall back to static data when `DATABASE_URL` is absent, while persistent
and private operations fail or return empty data. This is a pragmatic local workflow,
but environment inspection inside persistence functions makes the active capability
set implicit.

**Risk:** preview or production can accidentally exhibit partial local semantics;
callers cannot tell from types whether an operation supports fallback; tests have to
manipulate global environment state.

**Advice:** resolve a typed runtime mode once during composition:

```ts
type RuntimeMode = 'local-fallback' | 'database';
```

Construct either a `StaticGraphRepository` or `PostgresGraphRepository`, and expose a
capability matrix in health output. Production and preview should fail startup or
health checks when configured for database mode but unable to connect. Keep fallback
read-only, visibly label it in diagnostics, and never silently downgrade private,
admin, billing, or ingestion writes.

### 3. The mobile API is a growing gateway (P1)

`/api/mobile` multiplexes public content, practice, saved cards, notes, graph,
dashboard, ranking, and admin operations using `resource` and `action` strings. It
also owns body bounds, validation, authorization, dispatch, and response mapping.

**Risk:** a single change has a wide blast radius, per-resource authorization is
easy to overlook, caching and observability cannot be tuned by URL, and compatibility
is difficult to describe independently.

**Advice:** preserve the client-facing behavior initially, but move each case into a
typed handler table backed by application services. Then introduce versioned,
resource-oriented endpoints such as `/api/mobile/v1/practice` and
`/api/mobile/v1/notes`, with the old endpoint acting as a temporary adapter. Define
Zod request/response schemas in a framework-neutral contracts package and test both
client decoding and server encoding against them. Do not share database row types.

### 4. Persistence ownership needs one source of truth (P1)

The repository includes Drizzle schema definitions, ordered migrations, and a large
`schema.sql` bootstrap representation, while runtime access is primarily handwritten
SQL through a minimal Neon adapter. That combination can work, but ownership and
generation rules need to be explicit.

**Risk:** schema representations drift, handwritten query result types can disagree
with database reality, and bulk multi-step changes may lack an obvious transaction
boundary.

**Advice:** designate Drizzle schema plus migrations as authoritative. Either generate
`schema.sql` as a documented artifact or remove it from the normal migration path.
Add a CI drift check using a disposable PostgreSQL database. Retain handwritten SQL
where it is clearer or more performant, but place it behind repositories and validate
returned shapes. Add transaction-capable repository methods for multi-record state
changes rather than looping over independent writes.

### 5. Shared contracts are narrower than the shared product surface (P1)

`@stem-brain/shared` centralizes locale and taxonomy helpers, and the graph package
exports domain types. Mobile API response types, however, are maintained in the
mobile client while server response construction lives in the web application.

**Risk:** mobile/server drift is detected late, normally at runtime, and endpoint
refactors require coordinated manual edits.

**Advice:** create `@stem-brain/contracts` only for serialized public contracts and
schemas. Keep it dependency-light and free of Next.js, Expo, database, and provider
SDK imports. Version contracts when compatibility cannot be preserved. This package
should not become a general dumping ground; internal application and persistence
types stay within their capabilities.

### 6. Several modules exceed a comfortable change surface (P1)

The largest handwritten behavior modules cover Toss subscriptions, card actions,
knowledge ingestion, content localization, mobile sign-in, and graph visualization.
File size is not itself an architectural defect, but these modules cross policy,
I/O, validation, and presentation concerns.

**Risk:** review quality falls, isolated tests require extensive setup, and ownership
becomes ambiguous.

**Advice:** split by cohesive responsibility rather than an arbitrary line target.
For example, separate billing provider transport, signature verification, lifecycle
policy, persistence, and use-case orchestration. For large UI screens, extract hooks
that own state transitions and pure view components, while keeping navigation in the
route component. Require a characterization test before moving complex behavior.

### 7. Scaling guidance should be signal-driven (P2)

The current architecture already identifies translation, reconciliation, and cleanup
as background-work candidates. They should remain in the monorepo and can initially
run as scheduled or queued Worker jobs invoking the same application services.

**Do not split a service because a module is large.** Extract a deployable only when
at least one of these signals is sustained:

- independent scaling materially lowers latency or cost;
- a failure domain must be isolated from interactive learning traffic;
- the capability has a distinct security or compliance boundary;
- separate release cadence and ownership are repeatedly blocked by the monolith;
- runtime constraints are incompatible with the Worker deployment.

If extraction becomes necessary, start with asynchronous translation or billing
webhook processing, not the graph domain. Use an outbox/idempotency design before
adding a broker so database state and event publication cannot diverge.

## Target boundaries

Dependencies should point inward and remain acyclic:

```text
transport (Next routes, server actions, MCP adapters)
  -> application use cases
      -> domain policy and ports
          <- infrastructure adapters (Postgres, Clerk, providers, Workers AI)

web UI ----\
mobile UI --+-> serialized contracts <- transport

application/domain -> graph-engine + shared
graph-engine ------> no app/framework package
```

Recommended rules:

- UI code never imports persistence modules.
- Transport handlers never call other transport handlers or server actions.
- Application services never read global request state.
- Provider SDK types never escape infrastructure adapters.
- Database rows never become API response contracts directly.
- Cross-capability writes happen through an application use case with an explicit
  transaction or an idempotent workflow.

## Incremental roadmap

### Phase 1: clarify and protect (1–2 weeks)

1. Record an ADR confirming the modular-monolith decision and extraction signals.
2. Document the runtime-mode capability matrix and enforce it in environment checks.
3. Add dependency-boundary linting for packages and the new module layers.
4. Add contract tests for the current mobile endpoint before restructuring it.
5. Assign Drizzle migrations as the database source of truth and add a drift check.

**Exit criteria:** architecture rules are executable; production cannot silently use
fallback behavior; current mobile behavior is captured by tests.

### Phase 2: prove the application layer (2–4 weeks)

1. Extract `submit quiz` into an application service with a graph repository port.
2. Provide static and PostgreSQL repository implementations.
3. Make the API route and server action thin adapters over the same use case.
4. Add tests for authorization, cooldown, unknown nodes, persistence failure, and
   diffusion results without booting Next.js.
5. Apply the pattern to card retrieval and personal knowledge writes.

**Exit criteria:** at least three entry points share use cases without importing one
another, and SQL is confined to infrastructure modules for those slices.

### Phase 3: stabilize mobile and operations (3–6 weeks)

1. Publish shared Zod wire schemas and add compatibility tests.
2. Split mobile resources behind `/api/mobile/v1/*`, retaining a measured adapter
   deprecation period.
3. Add structured logs containing request ID, actor class (not user PII), capability,
   runtime mode, duration, and normalized error code.
4. Establish service-level indicators for route latency, error rate, database query
   latency, translation backlog, and webhook retries.
5. Move demonstrably slow or retry-sensitive work to scheduled/queued handlers.

**Exit criteria:** mobile changes are contract-checked, high-risk flows are observable,
and background extraction is justified by measured data.

## Decision register

| Decision | Status | Revisit when |
| --- | --- | --- |
| Keep one backend deployable | Recommended | An extraction signal above persists for two planning cycles. |
| Keep graph-engine framework-independent | Recommended | Never, unless its product ownership fundamentally changes. |
| Keep local static fallback | Recommended with guardrails | It creates production ambiguity or maintenance cost exceeds onboarding value. |
| Add a shared contracts package | Recommended | Before adding versioned mobile endpoints. |
| Adopt microservices | Not recommended | Independent scale, security, failure, or ownership boundaries are measured. |
| Adopt a broker immediately | Not recommended | A durable asynchronous workflow and its delivery semantics are defined. |

## Architecture review checklist

Use this checklist for significant changes:

- [ ] Is the business rule in an application/domain module rather than a route?
- [ ] Is authentication performed once and the actor passed explicitly?
- [ ] Are authorization and tenant/user scoping tested at every entry point?
- [ ] Is the runtime mode and fallback behavior explicit?
- [ ] Does the operation need a database transaction or idempotency key?
- [ ] Are request and response schemas shared and backward compatible?
- [ ] Are logs useful without including secrets, tokens, card contents, or user PII?
- [ ] Does a background operation define retries, timeouts, and poison-message handling?
- [ ] Does the dependency graph still point inward without framework leakage?
- [ ] Is a new deployable justified by measured scaling, isolation, or ownership needs?
