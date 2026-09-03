# Rich Flow and Timeline Blocks

Status: Active

## User outcome

A user can write a directed flow or ordered timeline inside an existing
multiline prose field, review the result before saving, and later edit the
exact source. Web and mobile show the same relationships, order, and labels
without turning the block into executable code or a Knowledge Map edge.

## Scope

In scope:

- explicit column-zero `:::flow` and `:::timeline` lines closed by a
  column-zero `:::` line, with no indentation or trailing text;
- one JSON tuple per non-empty source line so `::`, `|`, arrows, formulas, and
  inline-code punctuation stay literal;
- flow rows shaped as `["source", "target", "relationship"]` and timeline rows
  shaped as `["when", "title"]` or `["when", "title", "detail"]`;
- source-order rendering with visible direction and relationship meaning for
  flows, and visible time, title, and optional detail for timelines;
- dependency-free semantic HTML/CSS rendering on web and inside the existing
  aggregate Expo DOM boundary on mobile; and
- localized editor guidance and live preview on the existing web and mobile
  knowledge editors.

The renderer accepts at most 24 rows, 6,000 source Unicode code points, and 500
Unicode code points per tuple value. Tuple values must be single-line strings without
decoded control characters and required values must be non-empty after
trimming; only a timeline detail may be empty. Invalid, oversized, unclosed, or
empty visual blocks remain literal source text. Blank source lines inside a
valid block are ignored.

## Authoring syntax

Flow tuple order matches the existing structure-relation editor: source,
target, then relationship. Rendering moves the relationship between its
endpoints so the reading order remains source, relationship, target.

```text
:::flow
["LDL", "Plaque", "contributes to"]
["Plaque", "Narrowed artery", "can cause"]
:::
```

Timeline rows stay in authored order and accept an optional detail.

```text
:::timeline
["1789", "French Revolution begins"]
["1791", "First constitution", "A constitutional monarchy is established."]
:::
```

Tuple lines are strict JSON. A math delimiter therefore needs JSON escaping;
for example, the source text `"Mass \\(m\\)"` decodes to `Mass \(m\)` before
notation rendering. Backticks and punctuation such as `::`, `|`, and `→` need
no special visual-block escaping beyond normal JSON string rules.

Out of scope:

- Mermaid, arbitrary HTML or SVG, remote scripts, remote fonts, or executable
  diagram code;
- automatic layout inference from prose, nested visual blocks, author-defined
  colors/shapes, or drag-and-drop editing;
- converting a visual row into a public or private Knowledge Map node or edge;
- sorting timeline rows, inferring dates/eras, or changing existing event
  chronology behavior; and
- a new knowledge-bundle type, storage field, migration, or backfill.

## Acceptance criteria

- [x] `AC-01`: The shared parser recognizes only complete standalone visual
  directives, keeps inline or fenced code that begins before a directive as a
  higher-priority barrier, then keeps math and inline-code parsing inside
  decoded tuple values, and scans adversarial unmatched openers in linear time.
- [x] `AC-02`: Flow and timeline rows require the documented JSON tuple shapes
  and limits, preserve the exact block source and tuple punctuation, and fall
  back to literal text for any invalid row or limit violation.
- [x] `AC-03`: Web renders valid flows and timelines as responsive semantic
  lists with visible direction/order, localized captions, and math or inline
  code inside tuple values; invalid input creates no HTML or external request.
- [x] `AC-04`: Mobile keeps ordinary cards on the native path and renders all
  visual blocks for one notation-rich bundle inside its existing single local
  DOM boundary, with bounded responsive layout and a source-derived
  accessibility label.
- [x] `AC-05`: Web and mobile editors document both directive forms and show
  them in the existing live preview without changing the exact stored bundle
  JSON or flat compatibility projection.
- [x] `AC-06`: Translation guards preserve complete visual directives
  byte-for-byte, and the feature changes no selection, pending review,
  approval, ownership, retention, search, publication, or graph-edge behavior.

## Privacy and data boundaries

Visual parsing happens only after content has arrived through the existing
owner-scoped or public read path. The source remains an ordinary string in the
existing bundle JSON or note field. The renderer does not send source to a
diagram service, fetch user-provided resources, execute code, approve a draft,
or create a graph relation. A directed row communicates only the author's
card-internal presentation; it is not canonical graph evidence.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/src/lib/knowledge-text.test.ts` covers directive boundaries, code precedence, mixed cell notation, unmatched openers, and a 30,000-opener scan. |
| `AC-02` | `apps/web/src/lib/knowledge-text.test.ts` covers tuple shapes, row/source/cell limits, control characters, exact source, punctuation, and atomic literal fallback. |
| `AC-03` | `apps/web/e2e/browser-smoke.spec.ts` exercises the live editor at desktop and mobile widths, checks semantic rows, captions, nested notation, invalid-source fallback, reload non-persistence, unsafe elements, external requests, console errors, and geometry; the full browser harness passes 88 tests. |
| `AC-04` | `apps/mobile/src/knowledge-bundle-notation.test.ts`, `apps/mobile/src/knowledge-bundle-ui.test.ts`, and `apps/mobile/scripts/export-release-bundle.mjs` verify detection, source-derived accessibility, one aggregate DOM boundary, responsive markup, and iOS/Android release exports with local notation assets. |
| `AC-05` | Six web catalogs and six mobile help entries are validated by web/mobile tests; the focused Playwright scenario proves both directives through the existing live editor and exact source after reload. |
| `AC-06` | `apps/web/src/lib/content-translation-guards.test.ts` proves byte-for-byte directive preservation, while `pnpm harness:ci`, `pnpm harness:browser`, and `pnpm harness:deploy` preserve the existing bundle, privacy, graph, build, and release contracts. |

## Rollout

There is no migration, backfill, feature flag, provider activation, or new
runtime dependency. Older clients continue to show the stored directive source
as text. Rollback removes only the enhanced presentation because the same plain
source remains readable and editable. Preview and production smoke must prove a
flow, a timeline, invalid-source fallback, responsive layout, zero unsafe
resource creation, and an unchanged ordinary-text path. Real-device Expo DOM
sizing and screen-reader behavior remain separate device evidence.
