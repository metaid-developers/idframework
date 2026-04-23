# Demo Note Pagination And Readability Design

## Goal

Add user-visible pagination to the `demo-note` public and personal note lists, and improve the note detail reading experience by increasing text-to-background contrast inside the article body.

## Context

The current list view only fetches the first 20 notes. The existing store and commands already carry cursor metadata, but the `id-note-list` component never wires pagination behavior. The detail view uses a dark container while `id-note-markdown-view` renders dark body text, which makes article content hard to read.

## Requirements

1. Public and `My Note` list views must let the user move beyond the first page.
2. Pagination should be explicit and predictable, not scroll-triggered.
3. Existing `metaid_man` cursor-based APIs stay unchanged.
4. Detail view should preserve the overall app look, but the article body must have clearly readable text and supporting styles.

## Design

### Pagination Model

Keep the backend cursor contract and add explicit pagination state on each list segment (`publicList`, `myList`):

- `page`: current 1-based page number
- `pageSize`: current page size, default `20`
- `currentCursor`: the exact cursor value used to fetch the page currently on screen; page 1 always uses `'0'`
- `cursor`: keep the existing meaning as the backend-provided next-page cursor for the page currently on screen
- `cursorHistory`: ordered array of fetch cursors for the pages currently traversed; page 1 starts as `['0']`, page 2 becomes `['0', '<page-2-fetch-cursor>']`, and moving back trims the tail

The list component will render a footer pager with `Previous`, `Next`, and current page indicator. `Previous` and `Next` dispatch the existing note list commands with `replace: true`, so page navigation replaces the current 20 items instead of appending. `Next` uses the segment’s `cursor`; `Previous` uses the previous entry from `cursorHistory`.

Interaction rules:

- `Previous` is disabled on page 1
- `Next` is disabled when `hasMore` is `false`
- both buttons are disabled while a page fetch is in flight
- clicks while loading are ignored so cursor history cannot be corrupted

The commands keep their current append behavior for callers that rely on it, but accept pagination-specific payload fields:

- `replace: true` to replace items rather than append
- `page`, `pageSize`, `currentCursor`, `cursorHistory` to sync store pagination state
- `size` remains the backend request field; commands derive it from `pageSize` when only `pageSize` is supplied

`demo-note/app.js` will reset list pagination on route entry so `#/` and `#/mynote` always load from page 1 when the app newly enters either list route from a different route or on first bootstrap. Pagination state does not persist once the user leaves the list route.

For `My Note`, pager requests resolve the address from the same wallet/user store path already used by `loadRouteData()`. If no address is available, the component does not dispatch a fetch and keeps pager actions disabled.

### Detail Readability

Keep the dark outer detail shell and move the reading surface to a high-contrast article card:

- wrap markdown output in a lighter “paper” surface
- use darker text, headings, links, blockquotes, and code styles inside the reading area
- keep tags, meta, and attachments visually consistent with the existing theme

`id-note-markdown-view` will expose reusable CSS custom properties for the reading surface so the detail component can set a readable theme without hardcoding another one-off renderer.

Minimum markdown theme contract:

- `--note-markdown-bg`
- `--note-markdown-text`
- `--note-markdown-link`
- `--note-markdown-code-bg`
- `--note-markdown-code-border`

## Testing

1. Extend unit tests for `FetchNoteListCommand` and `FetchMyNoteListCommand` to cover `replace: true` pagination behavior and state updates.
2. Add `id-note-list` component tests for pager rendering and command dispatch on next/previous actions.
3. Add detail/markdown component tests asserting the readable article surface and theme variables are present.
4. Re-run `node --test test/*.test.mjs`.

## Risks

- Cursor history must stay aligned with the currently displayed page; otherwise previous-page navigation can drift.
- Readability fixes should only affect note detail article content, not global app colors or other components.
