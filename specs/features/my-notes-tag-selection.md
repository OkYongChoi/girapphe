# My Notes tag selection

Status: Implemented

## User outcome

When creating or editing a My Notes item, the user can reuse their most
frequently used tags or type any tag directly.

## Scope

In scope:

- Suggest up to 500 of the current owner's most frequent active My Notes tags
  in the create and edit forms.
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
- [x] `AC-08`: Normalization preserves meaningful combining marks in supported
  scripts, strips unattached leading marks, accepts ASCII, Arabic, and
  full-width comma separators, and does not commit a separator until active IME
  composition ends.

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
| `AC-07` | `apps/web/e2e/stabilization.spec.ts` uses two same-owner pages to prove stale-write rejection and the exact winning tags before retry, and proves that another edit preserves a create title, structured bundle, and tags until that create succeeds. |
| `AC-08` | `apps/web/src/lib/knowledge-tag-normalization.test.ts` covers Hindi, vocalized Arabic, marks-only and unattached-leading-mark cleanup, and truncation cleanup; local desktop/mobile browser tests dispatch a composing input containing a full-width comma and prove that it becomes a tag only after `compositionend`, while authenticated desktop/mobile tests cover localized comma entry and canonical suggestion search. |
| Authenticated Preview | `apps/web/e2e-authenticated/authenticated-my-notes-tags.spec.ts` repeats rendered desktop/mobile selection, mutation, reset, stale-write, touch-target, and overflow evidence against the isolated synthetic Preview owner. |

## Rollout

No migration or activation step is required. The existing `tags` form field and
server action remain backward compatible; rollback is a UI-only revert.
