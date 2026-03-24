# Demos Chat Core Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a no-build, IDFramework-native `demos/chat` app that covers idchat core group/private chat flows while landing reusable, decoupled chat components under `idframework/components`.

**Architecture:** Keep Alpine stores as the single source of truth (`wallet`, `app`, `user`, `chat`), route all business behavior through commands/delegates, and keep components as view-only renderers + event emitters. Reuse existing mature pieces first (`id-connect-button`, `id-avatar`, `id-chat-input-box`, `id-chat-bubble`, `id-image-viewer`) and only add new components where composition boundaries are missing.

**Tech Stack:** IDFramework (MVC + command/delegate), Alpine stores, native Web Components (Shadow DOM), Metalet wallet bridge, Socket.IO client, existing remote APIs from `https://api.idchat.io/chat-api/group-chat`.

---

## Scope And Non-Goals

- In scope (MVP-to-product quality):
  - Channel list (group + private) from `latest-chat-info-list`
  - Conversation switching and message loading by index (group/private)
  - Realtime receiving via websocket push
  - Send text/image/file for group/private chat
  - Quote/reply rendering and send flow
  - @ mention input + mention display
  - Avatar/name rendering consistency
  - Image preview/lightbox and download
- Explicitly out of scope for this cycle:
  - DAO, announcement, red packet, NFT-gated channel logic
  - Full parity with all idchat advanced admin/channel ops

---

## Reuse-First Component Strategy

- Reuse directly:
  - `idframework/components/id-connect-button.js`
  - `idframework/components/id-userinfo-float-panel.js`
  - `idframework/components/id-avatar.js`
  - `idframework/components/id-image-viewer.js`
- Refactor and harden:
  - `idframework/components/id-chat-input-box.js`
  - `idframework/components/id-chat-bubble.js`
  - `idframework/components/id-chat-box.js`
  - `idframework/components/id-chat-chatlist-panel.js`
- New components (if needed after refactor):
  - `idframework/components/id-chat-thread-list.js` (replace/alias old chatlist panel)
  - `idframework/components/id-chat-header.js`
  - `idframework/components/id-chat-shell.js` (responsive layout shell, optional but recommended)

---

## Execution Order (Component-First)

### Task 1: Baseline Alignment (Config + Store + Command Registration)

**Files:**
- Modify: `demos/chat/chat.js`
- Modify: `demos/chat/chat.html`
- Modify: `demos/chat/chat.css`
- Modify: `idframework/utils/idconfig.js` (only if chat-specific defaults are missing)

- [ ] Remove legacy global handler coupling in `demos/chat/chat.html` (`window.handleSendMessage`, direct textarea send wiring).
- [ ] Normalize `ServiceLocator` for chat demo to production-aligned endpoints:
  - `idchat`: `https://api.idchat.io/chat-api/group-chat`
  - `metafs`: `https://file.metaid.io/metafile-indexer/api/v1`
  - optional `metaid_man`/`man_api` retained for user metadata.
- [ ] Ensure `chat` store shape is stable and command-friendly:
  - channels/conversations map + ordered ids
  - active conversation id/type/index
  - messages by conversation key
  - loading/error/read-state fields
- [ ] Register real commands (not mock path):
  - `fetchChatList`, `selectConversation`, `fetchGroupMessages`, `fetchPrivateMessages`, `sendChatMessage`, `fetchUser`, `fetchUserInfo`.
- [ ] Keep no-build route behavior stable (no invalid refresh URL transitions).

**Acceptance:**
- Demo boots without console errors.
- Wallet connected state persists and does not regress.
- Chat store initializes once and remains the only data source used by components.

---

### Task 2: Chat Data Commands Hardening (API Contract Parity)

**Files:**
- Modify: `idframework/commands/FetchChatListCommand.js`
- Modify: `idframework/commands/SelectConversationCommand.js`
- Modify: `idframework/commands/FetchGroupMessagesCommand.js`
- Create: `idframework/commands/FetchPrivateMessagesCommand.js`
- Modify: `idframework/commands/SendChatMessageCommand.js`

- [ ] Align `FetchChatListCommand` parsing to idchat behavior:
  - handle `type=1` group and `type=2` private cleanly
  - use stable conversation keying (groupId for group; peer global/meta id for private)
  - preserve last message/index/timestamp/unread fields.
- [ ] `SelectConversationCommand` dispatches group/private fetch paths correctly and resets unread/read cursor in store.
- [ ] `FetchGroupMessagesCommand` and new `FetchPrivateMessagesCommand` normalize messages into one canonical shape used by UI.
- [ ] Ensure message timestamps/index sorting is deterministic and stable after websocket merge.
- [ ] `SendChatMessageCommand` keeps group/private encryption behavior and supports text/file/reply/mention payloads used by `id-chat-input-box`.

**Acceptance:**
- Selecting any channel reliably loads the correct message list.
- No duplicated/negative-index chaos after load/refresh.
- Send result can be consumed for optimistic UI + reconciliation.

---

### Task 3: Realtime Sync Without Polling Storms

**Files:**
- Modify: `idframework/stores/chat/ws-new.js`
- Modify: `demos/chat/chat.js`
- Modify: `idframework/components/id-chat-chatlist-panel.js` (remove interval-heavy sync if still present)
- Modify: `idframework/components/id-chat-groupmsg-list.js` (or deprecate)

- [ ] Start websocket only after wallet has valid `globalMetaId`.
- [ ] Handle push events:
  - `WS_SERVER_NOTIFY_GROUP_CHAT`
  - `WS_SERVER_NOTIFY_PRIVATE_CHAT`
- [ ] Upsert pushed messages into active/inactive conversations and update unread counts.
- [ ] Remove unnecessary polling loops that cause repeated network calls and UI jitter.

**Acceptance:**
- Incoming messages appear in active chat in near real time.
- Inactive conversation list updates last message + unread badge.
- No infinite polling/request floods.

---

### Task 4: Thread List Component Productization

**Files:**
- Modify: `idframework/components/id-chat-chatlist-panel.js` (or split into thread-list + item)
- Optional Create: `idframework/components/id-chat-thread-list.js`
- Optional Create: `idframework/components/id-chat-thread-item.js`

- [ ] Replace debug/log-heavy rendering with deterministic, reactive rendering.
- [ ] Use `id-avatar` for all avatar rendering/fallback.
- [ ] Match idchat-like UX essentials:
  - active state
  - name + last message preview
  - relative time
  - unread badge
  - mention badge (if mention count exists in store)
- [ ] Keep component store-driven; avoid external payload injection as data source.

**Acceptance:**
- Left list is stable in light/dark mode.
- Clicking item switches chat reliably on desktop/mobile.
- List does not flicker/reflow on normal updates.

---

### Task 5: Message Stream Components (Group + Private)

**Files:**
- Modify: `idframework/components/id-chat-box.js`
- Modify: `idframework/components/id-chat-bubble.js`
- Optional Create: `idframework/components/id-chat-header.js`
- Optional Modify/Deprecate: `idframework/components/id-chat-msg-bubble.js`, `idframework/components/id-chat-groupmsg-list.js`

- [ ] Promote one canonical message list component path for both group/private (avoid split behavior drift).
- [ ] Ensure bubble rendering supports:
  - decrypted text
  - image/video/audio/file card
  - quote preview (avatar/name/text)
  - @ mention highlight + click event
- [ ] Hook image click to `id-image-viewer` event contract.
- [ ] Add unread divider / scroll-to-latest behavior if store supports unread cursor.

**Acceptance:**
- Group/private messages render with consistent UI and metadata.
- Quote/reply jump behavior works for visible message ranges.
- Media preview and download flows work.

---

### Task 6: Composer Component Finalization

**Files:**
- Modify: `idframework/components/id-chat-input-box.js`
- Modify: `demos/chat/chat.html`

- [ ] Use `id-chat-input-box` as the only message composer in demo.
- [ ] Ensure it reads active conversation context from store (attrs only as optional override, not required primary source).
- [ ] Validate feature set:
  - text send
  - image/file upload + local preview
  - emoji insert
  - quote/reply strip
  - @ mention dropdown from API (`group-member-list`, `search-group-members`)
- [ ] Ensure no input focus loss/jump after first character and no duplicate submit on Enter.

**Acceptance:**
- Sending text/image works in both group/private chat.
- Reply and mention payloads are correctly passed to send command.
- Composer is smooth on desktop/mobile.

---

### Task 7: Demo Assembly And UX Polish

**Files:**
- Modify: `demos/chat/chat.html`
- Modify: `demos/chat/chat.css`
- Modify: `demos/chat/app.css`

- [ ] Assemble demo from reusable components only (no app-specific business logic inside HTML script blocks).
- [ ] Responsive behavior:
  - desktop: sidebar + main
  - mobile: drawer/back behavior
- [ ] Fix dark mode contrast (no white text on white cards; no unreadable states).
- [ ] Ensure tabs/headers/containers align width and avoid overflow.

**Acceptance:**
- `http://127.0.0.1:8787/demos/chat/chat.html` is usable across desktop/mobile sizes.
- Visual hierarchy and spacing are production-acceptable.

---

### Task 8: Verification (Automated + Manual)

**Files:**
- Create: `test/fetch-chat-list-command.test.mjs`
- Create: `test/fetch-private-messages-command.test.mjs`
- Create: `test/select-conversation-command.test.mjs`
- Create: `test/send-chat-message-command.test.mjs`
- Create: `test/id-chat-input-box-component.test.mjs`
- Create: `test/id-chat-thread-list-component.test.mjs`

- [ ] Add parsing tests for channel list and message normalization.
- [ ] Add send-command payload tests (group/private/text/file/reply/mention).
- [ ] Add component tests for list rendering and composer behavior.
- [ ] Run full test subset and record command outputs.

**Manual checklist:**
- [ ] Connect wallet -> chat list loads once
- [ ] Switch between at least one group and one private chat
- [ ] Send text and image in both modes
- [ ] Receive websocket push and observe unread badge update
- [ ] Quote/reply render + send + jump works
- [ ] Dark mode readability passes
- [ ] No `/v1/v1` URL errors

---

## Quality Gates (Must Pass Before Component Is “Done”)

- URL correctness: no duplicated path segments (`/v1/v1`, repeated `/group-chat/group-chat`).
- Data source rule: components consume `Alpine.store` as single source of truth.
- No hidden polling loops that continuously hammer APIs.
- Rendering stability: no visible jitter/reflow spikes from avoidable rerenders.
- Reusability: new behavior should live in `idframework/components|commands|stores`, not hardcoded in `demos/chat`.

---

## Delivery Milestones

1. **M1 Foundation:** Task 1-3 complete (data correctness + realtime stable)
2. **M2 UI Core:** Task 4-6 complete (thread/message/composer product quality)
3. **M3 Demo Ready:** Task 7 complete (usable end-to-end demo)
4. **M4 Quality Signoff:** Task 8 complete (tests + manual checklist)

