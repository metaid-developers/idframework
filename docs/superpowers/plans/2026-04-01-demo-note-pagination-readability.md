# Demo Note Pagination And Readability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit list pagination to `demo-note` and improve detail article readability with a higher-contrast reading surface.

**Architecture:** Keep the existing cursor-based fetch commands, but add page state and a replace-mode fetch path so `id-note-list` can page forward and backward deterministically. Improve readability by styling `id-note-detail` and `id-note-markdown-view` through reusable CSS variables rather than adding a separate renderer.

**Tech Stack:** Web Components, Alpine stores, IDFramework command dispatch, Node test runner

---

### Task 1: Add Failing Pagination Tests

**Files:**
- Modify: `test/fetch-note-list-command.test.mjs`
- Modify: `test/fetch-my-note-list-command.test.mjs`
- Modify: `test/id-note-list-component.test.mjs`

- [ ] **Step 1: Write a failing replace-mode public list test**

Add a test showing `fetchNoteList` with `replace: true` replaces items and stores `page/currentCursor/cursorHistory`.

- [ ] **Step 2: Run the focused public list test to verify it fails**

Run: `node --test test/fetch-note-list-command.test.mjs`
Expected: FAIL because replace-mode pagination state is not implemented.

- [ ] **Step 3: Write a failing replace-mode my-list test**

Add a test showing `fetchMyNoteList` behaves the same for owner notes.

- [ ] **Step 4: Run the focused my-list test to verify it fails**

Run: `node --test test/fetch-my-note-list-command.test.mjs`
Expected: FAIL because owner list replace-mode pagination state is not implemented.

- [ ] **Step 5: Write failing list component pager tests**

Add tests for rendering `Previous`/`Next` controls and dispatching the correct command payload for each direction.

- [ ] **Step 6: Run the focused list component test to verify it fails**

Run: `node --test test/id-note-list-component.test.mjs`
Expected: FAIL because pager UI and interactions do not exist yet.

### Task 2: Implement Pagination State And Controls

**Files:**
- Modify: `demo-note/app.js`
- Modify: `idframework/commands/FetchNoteListCommand.js`
- Modify: `idframework/commands/FetchMyNoteListCommand.js`
- Modify: `idframework/components/id-note-list.js`

- [ ] **Step 1: Add default pagination fields to note list models**

Update `NOTE_MODEL` and store-shape helpers so `publicList` and `myList` both include `page`, `pageSize`, `currentCursor`, and `cursorHistory`.

- [ ] **Step 2: Implement replace-mode pagination in `FetchNoteListCommand`**

Honor `payload.replace`, replace items instead of append, keep `cursor` as the next-page cursor, and persist `page/pageSize/currentCursor/cursorHistory` to the public list store.

- [ ] **Step 3: Implement replace-mode pagination in `FetchMyNoteListCommand`**

Mirror the same logic for the personal list store, still requiring `address` from the existing wallet/user resolution path.

- [ ] **Step 4: Reset list pagination on route-entry fetches**

Make `loadRouteData()` request page 1 with replace semantics for `#/` and `#/mynote`.

- [ ] **Step 5: Add pager rendering and click handling to `id-note-list`**

Render a footer pager, disable buttons correctly (`Previous` on page 1, `Next` when `hasMore=false`, both while loading), and dispatch `fetchNoteList` or `fetchMyNoteList` with the right cursor/history payload.

- [ ] **Step 6: Run focused pagination tests**

Run: `node --test test/fetch-note-list-command.test.mjs test/fetch-my-note-list-command.test.mjs test/id-note-list-component.test.mjs`
Expected: PASS.

### Task 3: Add Failing Readability Tests

**Files:**
- Modify: `test/id-note-detail-component.test.mjs`

- [ ] **Step 1: Write a failing detail readability test**

Add a test asserting the detail component renders a dedicated article body surface and passes readable theme variables to `id-note-markdown-view`.

- [ ] **Step 2: Run the focused detail component test to verify it fails**

Run: `node --test test/id-note-detail-component.test.mjs`
Expected: FAIL because the readable article surface does not exist yet.

### Task 4: Implement Detail Reading Surface

**Files:**
- Modify: `idframework/components/id-note-detail.js`
- Modify: `idframework/components/id-note-markdown-view.js`

- [ ] **Step 1: Add theme variables to `id-note-markdown-view`**

Replace hardcoded text/link/code colors with CSS custom properties and keep safe defaults for text, link, reading-surface background, and code block surfaces/borders.

- [ ] **Step 2: Add a readable article body container in `id-note-detail`**

Wrap markdown output in a lighter reading surface and set high-contrast markdown theme variables there.

- [ ] **Step 3: Tune supporting detail styles**

Adjust spacing, border, and attachment/title colors only as needed to keep the article body clearly legible.

- [ ] **Step 4: Run the focused detail test**

Run: `node --test test/id-note-detail-component.test.mjs`
Expected: PASS.

### Task 5: Full Verification

**Files:**
- No source changes required unless verification exposes gaps

- [ ] **Step 1: Run the full test suite**

Run: `node --test test/*.test.mjs`
Expected: PASS with zero failures.

- [ ] **Step 2: Verify in the browser**

Open `http://127.0.0.1:4173/demo-note/index.html#/` and confirm:
- public list shows pager controls
- next/previous page navigation works
- detail article text is readable against its background

- [ ] **Step 3: Commit**

```bash
git add demo-note/app.js idframework/commands/FetchNoteListCommand.js idframework/commands/FetchMyNoteListCommand.js idframework/components/id-note-list.js idframework/components/id-note-detail.js idframework/components/id-note-markdown-view.js test/fetch-note-list-command.test.mjs test/fetch-my-note-list-command.test.mjs test/id-note-list-component.test.mjs test/id-note-detail-component.test.mjs docs/superpowers/specs/2026-04-01-demo-note-pagination-readability-design.md docs/superpowers/plans/2026-04-01-demo-note-pagination-readability.md
git commit -m "feat: add note pagination and readable detail styling"
```
