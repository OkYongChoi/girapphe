# Expression, History, and Causality

Status: Implemented

## User outcome

A user can review and approve language expressions, place historical events in
an oldest-first timeline (including BCE/CE dates), and connect private
knowledge with directional causal relationships backed by selected evidence.

## Scope

In scope:

- expression bundles and bidirectional expression practice;
- structured exact, approximate, and ranged BCE/CE event chronology;
- reviewed owner-scoped causal relations and additive mobile capability
  negotiation; and
- backward-compatible projections for existing notes and older clients.

Out of scope:

- automatic conversion or backfill of existing notes;
- causal edges in the public STEM graph; and
- ingestion of unselected or historical conversation transcripts.

## Acceptance criteria

- [x] `AC-01`: `expression` is a version-one knowledge bundle with a structurally valid BCP
  47 language tag, including grandfathered and private-use tags, plus meanings,
  translations, pronunciation, register, nuance, usage contexts, examples,
  contrasts, and common mistakes.
- [x] `AC-02`: Web and mobile editors preserve every expression field. Practice supports
  expression-to-meaning and meaning-to-expression recall without changing the
  existing rating state.
- [x] `AC-03`: `event` keeps its human-readable `occurred_at` field and may add structured
  BCE/CE chronology with exact, approximate, or range precision.
- [x] `AC-04`: Topic timelines contain events only and sort oldest first; lifecycle activity
  remains a separate newest-first feed. Undated events remain visible last.
- [x] `AC-05`: Private relations accept `causes`, `contributes_to`, `enables`, and `inhibits`.
  Extracted or model-proposed causal relations are unselected by default and
  require an explicit per-relation review of target, direction, type, origin,
  and at least one mapped evidence selector. Bulk and mobile quick approval
  cannot bypass this review; manual user links may be explicit without imported
  evidence.
- [x] `AC-06`: MCP tools create editable pending drafts only. They never ingest raw history,
  approve a draft, publish knowledge, or expose another user's content.
- [x] `AC-07`: Mobile clients declare additive knowledge capabilities. A client without the
  new capability header receives expression data as legacy flat content, event
  bundles without structured chronology, and no causal relation types. It must
  upgrade before editing data whose hidden structured fields could be lost.
- [x] `AC-08`: A blank mobile chronology removes no data by itself. A non-empty invalid
  chronology blocks the save instead of being silently discarded. Existing
  quick notes, version-one bundles, and the public STEM graph remain unchanged;
  there is no automatic backfill.

## Privacy and data boundaries

Only explicitly selected current-conversation content may become a pending
draft. Approval remains owner-scoped and reviewable, causal evidence stores
selectors rather than transcript excerpts, and no draft or private relationship
is written to the public STEM graph. Additive migration and capability handling
must preserve older clients without exposing hidden structured data to edits.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/src/lib/knowledge-bundles.test.ts` covers accepted private-use/grandfathered tags and rejects malformed or duplicate subtags. |
| `AC-02` | `apps/web/src/lib/knowledge-bundles.test.ts` and `apps/mobile/src/knowledge-bundle-ui.test.ts` cover structured expression round-trips and reverse recall cues. |
| `AC-03` | Web parser tests reject incomplete ranges; `apps/mobile/src/knowledge-topic.test.ts` covers BCE/CE ordering. |
| `AC-04` | `apps/mobile/src/knowledge-topic.test.ts` and `apps/web/src/lib/topic-knowledge-hub.test.ts` cover timeline labeling, order, and evidence retention. |
| `AC-05` | `apps/web/src/lib/knowledge-ingestion.test.ts` proves detailed causal review and evidence retention; `knowledge-map-private-edges.test.ts` covers directed private edges. |
| `AC-06` | Both MCP schema test suites require causal evidence and reject transcript/history/message fields. |
| `AC-07` | `apps/web/src/lib/mobile-knowledge-capabilities.test.ts` proves legacy projection and capable-client preservation. |
| `AC-08` | `apps/mobile/src/knowledge-bundle-ui.test.ts` blocks invalid non-empty chronology; `apps/web/scripts/apply-preview-schema.test.mjs` proves the migration is additive and owner-scoped. |

Repository checks, the deployment build, and rendered desktop/mobile smoke are
the release-level evidence for the combined feature.

## Rollout

Migration `0018_expression_history_causality.sql` is additive and performs no
automatic note conversion. Older mobile clients keep compatibility projections;
capable clients opt into structured fields. PR #157 delivered the feature, but
future changes must repeat the relevant harness, migration, Preview, and
production smoke evidence rather than relying on that historical release.
