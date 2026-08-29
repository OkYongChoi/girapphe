# Expression, History, and Causality

## User outcome

A user can review and approve language expressions, place historical events in
an oldest-first timeline (including BCE/CE dates), and connect private
knowledge with directional causal relationships backed by selected evidence.

## Acceptance criteria

- `expression` is a version-one knowledge bundle with a structurally valid BCP
  47 language tag, including grandfathered and private-use tags, plus meanings,
  translations, pronunciation, register, nuance, usage contexts, examples,
  contrasts, and common mistakes.
- Web and mobile editors preserve every expression field. Practice supports
  expression-to-meaning and meaning-to-expression recall without changing the
  existing rating state.
- `event` keeps its human-readable `occurred_at` field and may add structured
  BCE/CE chronology with exact, approximate, or range precision.
- Topic timelines contain events only and sort oldest first; lifecycle activity
  remains a separate newest-first feed. Undated events remain visible last.
- Private relations accept `causes`, `contributes_to`, `enables`, and `inhibits`.
  Extracted or model-proposed causal relations are unselected by default and
  require an explicit per-relation review of target, direction, type, origin,
  and at least one mapped evidence selector. Bulk and mobile quick approval
  cannot bypass this review; manual user links may be explicit without imported
  evidence.
- MCP tools create editable pending drafts only. They never ingest raw history,
  approve a draft, publish knowledge, or expose another user's content.
- Mobile clients declare additive knowledge capabilities. A client without the
  new capability header receives expression data as legacy flat content, event
  bundles without structured chronology, and no causal relation types. It must
  upgrade before editing data whose hidden structured fields could be lost.
- A blank mobile chronology removes no data by itself. A non-empty invalid
  chronology blocks the save instead of being silently discarded.
- Existing quick notes, version-one bundles, and the public STEM graph remain
  unchanged; there is no automatic backfill.

## Verification

- Shared/web parsers accept valid private-use, grandfathered, variant, extension,
  and region language tags while rejecting malformed or duplicated subtags.
  They also reject invalid chronology ranges and causal evidence indexes.
- Mobile edit round-trips cover expression and BCE/CE ranges.
- Resolution tests prove causal relations are explicitly selected, remain an
  exact subset of the reviewed draft, and retain mapped reviewed evidence.
- MCP schema tests prove causal evidence is required and raw conversation fields
  remain rejected.
- Repository checks, deployment build, and rendered desktop/mobile smoke pass.
