# My Notes tag selection

Status: Active

## User outcome

When creating or editing a My Notes item on web, iOS, or Android, the user can
reuse their most frequently used tags or type any tag directly.

## Scope

In scope:

- Suggest up to 500 of the current owner's most frequent active My Notes tags
  in the web and shared Expo create and edit forms.
- Select suggested tags as removable chips.
- Preserve direct entry, Enter-to-add, and comma-separated tag input.

Out of scope:

- Global or public tag taxonomies.
- Tag renaming, merging, or a separate tag-management page.
- Changes to the persisted tag format or server-side tag limits.

## Acceptance criteria

- [x] `AC-01`: Create and edit forms offer up to 500 frequently used tags from
  the current owner's active notes as selectable suggestions while direct entry
  remains available for every other tag.
- [x] `AC-02`: Users can combine selected suggestions with manually typed tags,
  and both paths use the same server/client normalization contract.
- [x] `AC-03`: Removing a selected tag updates the submitted tag list without
  affecting other note fields.
- [x] `AC-04`: A successful create resets the picker, and the UI never submits
  more than the existing 12-tag limit.
- [x] `AC-05`: The server ranks at most 500 suggestions, searchable suggestions
  render only on request with at most 24 options in the DOM, composition Enter
  does not commit CJK text, and mobile controls meet the 44px target convention.
- [x] `AC-06`: Tags are limited to 48 Unicode code points, long chips stay
  inside the mobile picker, and Escape/removal return keyboard focus predictably.
- [x] `AC-07`: An unrelated My Notes mutation preserves an in-progress create
  draft, while a stale edit reloads the winning server version before retry.
  Cancel or selecting another note advances the editor identity, so a delayed
  stale reload cannot restore the cancelled note or replace the selected note.
  Editor mutation controls are locked during save, and a stale item missing
  from the active reload keeps all entered fields as an unsaved new note.
- [x] `AC-08`: Shared normalization preserves meaningful combining marks in
  supported scripts, strips unattached leading marks, and accepts ASCII,
  Arabic, and full-width comma separators. On web, separator handling waits for
  the DOM composition lifecycle to end. React Native `TextInput` does not expose
  that web composition-event contract, so native source tests cover only text
  delivered through `onChangeText` and explicit `onSubmitEditing`.
- [x] `AC-09`: The shared iOS and Android form derives suggestions only from
  owner-scoped active notes, renders selected tags as removable 44-point chips,
  keeps the suggestion panel closed until requested, caps rendered matches at
  24, and includes a valid uncommitted draft when the user taps Add or Save.
  The native parser handles committed ASCII, Arabic, and full-width comma text
  without relying on an invented or undocumented React Native composition API.
- [ ] `AC-10`: Physical iOS and Android checks with representative CJK and
  complex-script keyboards prove that an in-progress IME composition is not
  prematurely converted into a tag, and that Enter/comma behavior matches the
  text actually committed by each platform keyboard.

## Privacy and data boundaries

Suggestions are derived only from the owner-scoped active notes already loaded
for the current My Notes view. No global tag data, new persistence, or
cross-owner projection is introduced. Existing server-side sanitization and the
12-tag limit remain authoritative.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/e2e/stabilization.spec.ts` creates tags through the owner-scoped My Notes flow and selects them in both create and edit forms. |
| `AC-02` | `apps/web/src/lib/knowledge-tag-normalization.test.ts` and the desktop/mobile flow cover separator canonicalization, post-normalization deduplication, invalid/reserved tags, selected tags, composed CJK input, same-tick input plus Enter, and repeated empty Enter without an accidental form submission. |
| `AC-03` | The rendered flow removes a selected chip and asserts the submitted hidden value changes independently. |
| `AC-04` | The rendered flow checks create reset and verifies that 13 pasted values produce exactly 12 submitted tags plus a visible limit state. |
| `AC-05` | `apps/web/src/lib/knowledge-tag-suggestions.test.ts` proves the ranked 500-tag boundary; the rendered flow verifies a closed-by-default, searchable, 24-result-bounded suggestion panel plus composition-safe Enter and 44px suggestion/removal controls on desktop and mobile. |
| `AC-06` | Unit and rendered tests verify the 48-code-point contract, mobile chip bounds, Escape-to-trigger focus, and input focus after chip removal. |
| `AC-07` | `apps/web/e2e/stabilization.spec.ts` uses two same-owner pages to prove stale-write rejection and the exact winning tags before retry, and proves that another edit preserves a create title, structured bundle, and tags until that create succeeds. `apps/mobile/src/my-notes-view.test.ts` uses delayed reloads to prove that native Cancel and note switching supersede the stale response without an editor overwrite and that a missing winner preserves the draft. `apps/mobile/src/mobile-notes-api-contract.test.ts` covers save-time editor locking and the unsaved-new-note recovery wiring. |
| `AC-08` | `apps/web/src/lib/knowledge-tag-normalization.test.ts` and rendered browser tests cover Unicode normalization and the DOM `compositionstart`/`compositionend` contract; native tests deliberately do not claim those browser events exist in React Native. |
| `AC-09` | `packages/shared/src/knowledge-tags.test.mjs`, `apps/mobile/src/mobile-knowledge-tags.test.ts`, and `apps/mobile/src/mobile-notes-api-contract.test.ts` cover shared normalization/ranking, committed native separator text, direct entry and selection bounds, uncommitted-draft submission, chip removal, closed 24-result suggestions, strict API validation, and 44-point controls. |
| `AC-10` | Pending physical-device evidence with iOS and Android IMEs; source, simulator export, or browser composition tests are not substitutes. |
| Authenticated Preview | `apps/web/e2e-authenticated/authenticated-my-notes-tags.spec.ts` repeats rendered desktop/mobile selection, mutation, reset, stale-write, touch-target, and overflow evidence against the isolated synthetic Preview owner. |

## Rollout

No migration or activation step is required. The existing `tags` field and
server action remain backward compatible; rollback is a client/UI revert.
Native release completion remains gated on physical iOS and Android IME checks;
repository tests prove normalization of committed text, not platform keyboard
composition timing.
