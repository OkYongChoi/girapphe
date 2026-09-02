# Rich Knowledge Notation

Status: Implemented

## User outcome

A user can write, review, and read mathematical formulas, chemical notation,
physical units, inline code, and code blocks inside the existing structured
knowledge bundles. The same source remains editable and reviewable, while web
and mobile present the notation in a legible form and show a preview before the
user saves it.

## Scope

In scope:

- an explicit, shared notation contract for inline `\\(...\\)`, display
  `\\[...\\]`, inline backticks, and fenced code blocks;
- KaTeX `mhchem` support for chemistry and units written inside math notation,
  including `\\ce{...}` and `\\pu{...}`;
- safe web rendering throughout structured knowledge bundles and compatibility
  rendering for legacy card explanations;
- notation-aware mobile rendering that keeps ordinary text on the native text
  path, invokes at most one bundled DOM renderer for each notation-rich card or
  structured bundle, and virtualizes notation-rich lists;
- live web and mobile previews in the existing manual bundle editors.

Out of scope:

- a new knowledge-bundle type or a database migration;
- automatic conversion of existing plain text, currency, code variables, or
  legacy notes into notation;
- arbitrary HTML, remote scripts or fonts, executable code, or user-authored
  SVG; and
- plots, molecular structure diagrams, circuit diagrams, syntax highlighting,
  or generalized visual blocks.

## Acceptance criteria

- [x] `AC-01`: The shared parser recognizes only explicit math and code
  delimiters by default, gives code precedence over math, preserves whitespace,
  and returns unmatched or malformed delimiters as literal text without losing
  user content. Repeated unmatched explicit-math openers remain linear-time.
- [x] `AC-02`: Every user-authored string rendered by the structured web bundle
  view can display inline and block math, `mhchem` chemistry and units, inline
  code, and fenced code. KaTeX emits accessible MathML, does not trust user
  commands, has finite expansion and size limits, and falls back to the exact
  source when rendering fails.
- [x] `AC-03`: The mobile structured bundle view preserves ordinary bundles as
  native text and uses one locally bundled, non-navigating DOM renderer per
  notation-rich bundle or virtualized card, with exact field boundaries and
  literal-source fallback on an invalid expression. High-cardinality note,
  review, topic, and candidate screens mount a bounded virtualized window
  instead of eagerly creating every DOM view.
- [x] `AC-04`: The web and mobile manual editors show a live structured preview
  before save, so the user can review notation together with its bundle
  context. The web editor also states the supported explicit syntax.
- [x] `AC-05`: Existing saved bundle JSON and flat compatibility projections
  remain authoritative and unchanged. Dollar-delimited math remains available
  only to the legacy explanation renderer, so currency and code variables in
  structured bundles are not reinterpreted.
- [x] `AC-06`: Rendering never executes stored code or accepts arbitrary HTML,
  and it adds no network request, ownership change, automatic approval,
  publication, or private-data exposure.

## Privacy and data boundaries

This change only interprets presentation markers after owner-scoped knowledge
has been loaded through the existing paths. It stores the exact user-authored
source, introduces no new server field, and does not alter draft selection,
review, approval, retention, ownership, search, or public/private graph rules.
The renderers use bundled assets and do not send notation or code to an external
service. Invalid input remains visible as literal source instead of being
discarded or executed.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/src/lib/knowledge-text.test.ts` covers explicit delimiters, precedence, whitespace, currency, malformed input, exact fallback, and an adversarial repeated-opener linear-time case. |
| `AC-02` | The focused KaTeX suite verifies MathML, `mhchem`, bounded trusted-command rejection, and literal fallback; a Firefox browser smoke on 2026-09-02 rendered nine math/MathML nodes, one display formula, one fenced-code block, and the copy interaction in the create preview and saved bundle view. |
| `AC-03` | Mobile lint/type checks and aggregate-renderer tests cover all 10 bundle types and enforce one notation boundary per rich bundle or virtualized card; both Expo release exports pass, and the export gate verifies the DOM bundle and all 20 local KaTeX font assets for iOS and Android. Note, review, topic, and candidate rows use bounded virtualized lists without fixed-height assumptions. A real-device WebView check remains release-activation evidence rather than repository evidence. |
| `AC-04` | The Firefox smoke exercised the web live preview before save and the saved read view. Mobile source checks and both platform exports cover the corresponding editor preview path; real-device sizing remains an explicit manual check. |
| `AC-05` | The full web and mobile bundle round-trip suites pass unchanged; focused parser coverage limits dollar delimiters to the explicitly enabled legacy explanation path. |
| `AC-06` | The focused safety suite and browser smoke show exact literal fallback for rejected trust commands, zero injected image nodes, no execution flag, no attacker request, and no browser console error. Ownership and persistence APIs are unchanged. |

## Rollout

There is no migration, backfill, feature flag, provider activation, or store
step. The web and Expo bundles must ship their own KaTeX and `mhchem` assets.
Rollback is a code rollback because stored source remains plain bundle JSON and
is readable without the enhanced renderer. Preview and production smoke must
verify both a notation-rich bundle and an ordinary-text bundle; a source build
alone does not prove mobile WebView sizing or rendered accessibility.
