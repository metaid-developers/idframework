# Demo Chat Private Decrypt Design

## Goal

Fix private chat rendering in `demo-chat` so both the left conversation preview and the message thread/body can decrypt private messages correctly, while keeping encrypted payloads in store state and following existing `idframework` patterns.

## Confirmed Scope

- Keep runtime decryption in view/helper flow instead of mutating persisted chat data.
- Follow the approved approach: tighten private decrypt inputs inside `SimpleTalkStore`.
- Fix both private message bubbles and private conversation preview text.
- Stay consistent with the current `idframework` split:
  - components render and wire context
  - stores/helpers resolve crypto details
  - demos assemble framework pieces instead of owning ad-hoc crypto logic

## Root Cause

Two gaps combine into the current failure:

1. `id-chat-groupmsg-list` initializes `SimpleTalkStore` but does not keep the store context in sync with the active private conversation, so private fallback resolution can miss the current peer.
2. `SimpleTalkStore` currently resolves private shared secrets too narrowly. It mainly depends on `fromGlobalMetaId` / `toGlobalMetaId` and remote user lookup, while the real payloads can carry the needed identity and key data through alternative fields such as:
   - `createGlobalMetaId`
   - `userInfo.globalMetaId`
   - `fromUserInfo.globalMetaId`
   - `toUserInfo.globalMetaId`
   - message-level `chatPublicKey`

## Design Direction

### 1. Keep encrypted state untouched

- Chat stores keep the original encrypted content.
- Decryption happens only when rendering previews or message content.
- This matches the current framework behavior and avoids hidden data mutations.

### 2. Push private-context wiring into the message list component

- `id-chat-groupmsg-list` should set `SimpleTalkStore` context whenever the active conversation snapshot changes.
- Public conversation:
  - `mode: 'public'`
  - `groupId: currentConversation`
- Private conversation:
  - `mode: 'private'`
  - `targetGlobalMetaId: currentConversation`

This preserves the component/store boundary already used in `id-chat-box`.

### 3. Make `SimpleTalkStore` private peer/key resolution resilient

- Add normalized helpers so private decrypt can resolve:
  - the peer globalMetaId from multiple message fields
  - the peer chat public key from message-local sources before falling back to remote lookup
- Cache shared secrets by peer globalMetaId as before.
- Preserve current group decrypt behavior.

Recommended resolution order:

1. Prefer message-local peer hints.
2. Prefer message-local chat public key when available.
3. Fall back to context `targetGlobalMetaId`.
4. Fall back to `fetchUserInfo(globalMetaId)` only when local key hints are absent.

### 4. Keep demo preview logic thin

- `demo-chat/chat.js` should continue calling `decryptText(...)`.
- If a small preview-side context bridge is still needed, keep it minimal and reuse `SimpleTalkStore` instead of duplicating crypto logic in the demo.

## Testing Strategy

- Add a failing component test that proves `id-chat-groupmsg-list` syncs crypto context for private conversations.
- Add failing `SimpleTalkStore` tests for:
  - peer resolution from non-primary private message fields
  - shared-secret resolution from message-local `chatPublicKey`
- Run focused tests first, then the relevant chat test set.

## Non-Goals

- No new branch or worktree.
- No store-level persistence refactor.
- No large chat architecture rewrite.
- No unrelated UI cleanup in `demo-chat`.
