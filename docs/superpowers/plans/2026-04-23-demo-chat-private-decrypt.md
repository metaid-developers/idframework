# Demo Chat Private Decrypt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore correct private-chat decryption in `demo-chat` for both conversation previews and message thread rendering.

**Architecture:** Keep encrypted payloads in chat state and perform decryption at runtime. Wire active conversation context from `id-chat-groupmsg-list` into `SimpleTalkStore`, then harden `SimpleTalkStore` so private peer resolution and shared-secret lookup work with the message shapes already used across `demo-chat`, fetch commands, and websocket updates.

**Tech Stack:** Native ES modules, Web Components, Alpine stores, Node `node:test`, CryptoJS, existing MetaID wallet ECDH APIs.

---

## File Structure

- Modify: `idframework/components/id-chat-groupmsg-list.js`
  - Sync crypto context from current conversation before bubbles hydrate.
- Modify: `idframework/stores/chat/simple-talk.js`
  - Add resilient private peer/public-key/shared-secret helpers.
- Modify: `demo-chat/chat.js`
  - Keep preview decrypt path thin; only add context plumbing if runtime helper still needs it.
- Modify: `test/id-chat-groupmsg-list-component.test.mjs`
  - Cover private context sync.
- Create: `test/simple-talk-store-private-decrypt.test.mjs`
  - Cover private peer resolution and message-local chat public key resolution.

## Task 1: Record Rules And Repair Plan

**Files:**
- Create: `AGENTS.md`
- Create: `docs/superpowers/specs/2026-04-23-demo-chat-private-decrypt-design.md`
- Create: `docs/superpowers/plans/2026-04-23-demo-chat-private-decrypt.md`

- [ ] **Step 1: Add the new development rules and approved design docs**

```md
1. Every development round must end with a commit, and we should commit as often as practical during the round.
2. After each commit, use Codex's `metabot-post-buzz` skill to publish that round's work as an on-chain development diary buzz.
3. Creating a new branch or worktree requires user approval first.
```

- [ ] **Step 2: Commit the docs checkpoint**

Run:
```bash
git add AGENTS.md docs/superpowers/specs/2026-04-23-demo-chat-private-decrypt-design.md docs/superpowers/plans/2026-04-23-demo-chat-private-decrypt.md
git commit -m "docs: record demo chat private decrypt rules and plan"
```

- [ ] **Step 3: Publish the docs checkpoint dev diary buzz**

Run:
```bash
cat > /tmp/demo-chat-private-decrypt-docs-buzz.json <<'EOF'
{
  "content": "Dev diary: documented the working rules for this repository, recorded the approved private-chat decryption design, and wrote the implementation plan for the demo-chat fix. The implementation will keep encrypted state intact, wire private conversation context into the crypto helper, and harden shared-secret resolution around message-local identity and chatPublicKey hints."
}
EOF
metabot buzz post --request-file /tmp/demo-chat-private-decrypt-docs-buzz.json
```

## Task 2: Write Failing Tests

**Files:**
- Modify: `test/id-chat-groupmsg-list-component.test.mjs`
- Create: `test/simple-talk-store-private-decrypt.test.mjs`

- [ ] **Step 1: Add a failing message-list context test**

```js
test('id-chat-groupmsg-list syncs private crypto context from active conversation', async () => {
  // snapshot => currentConversation: 'peer_global', conversationType: '2'
  // expect cryptoStore.setContext({ mode: 'private', targetGlobalMetaId: 'peer_global' })
});
```

- [ ] **Step 2: Add failing store tests for resilient private decrypt inputs**

```js
test('SimpleTalkStore private decrypt resolves peer from createGlobalMetaId and userInfo hints', async () => {
  // decryptText should derive the peer even when from/to are missing
});

test('SimpleTalkStore reuses message-local chatPublicKey before fetchUserInfo lookup', async () => {
  // getSharedSecret should call wallet ecdh with the inline key
});
```

- [ ] **Step 3: Run the focused tests and confirm RED**

Run:
```bash
node --test test/id-chat-groupmsg-list-component.test.mjs test/simple-talk-store-private-decrypt.test.mjs
```

Expected: FAIL because private context syncing and resilient private key resolution are not implemented yet.

## Task 3: Implement Minimal Fix

**Files:**
- Modify: `idframework/components/id-chat-groupmsg-list.js`
- Modify: `idframework/stores/chat/simple-talk.js`
- Modify: `demo-chat/chat.js` if needed

- [ ] **Step 1: Wire active conversation context into the crypto helper**

```js
_syncCryptoContext(snapshot) {
  if (!this._cryptoStore || !snapshot || !snapshot.currentConversation) return;
  if (snapshot.conversationType === '2') {
    this._cryptoStore.setContext({ mode: 'private', targetGlobalMetaId: snapshot.currentConversation });
    return;
  }
  this._cryptoStore.setContext({ mode: 'public', groupId: snapshot.currentConversation });
}
```

- [ ] **Step 2: Add resilient private peer/public-key/shared-secret helpers**

```js
_resolvePeerGlobalMetaId(message) {
  // inspect fromGlobalMetaId / toGlobalMetaId / createGlobalMetaId /
  // userInfo / fromUserInfo / toUserInfo / context.targetGlobalMetaId
}

_resolveChatPublicKey(message, peerGlobalMetaId) {
  // inspect message-local userInfo/fromUserInfo/toUserInfo before fetchUserInfo
}
```

- [ ] **Step 3: Keep preview decryption on the shared runtime path**

```js
const decrypted = await cryptoStore.decryptText({ ...message, protocol, content });
```

- [ ] **Step 4: Run focused tests, then the broader relevant chat tests**

Run:
```bash
node --test test/id-chat-groupmsg-list-component.test.mjs test/simple-talk-store-private-decrypt.test.mjs test/id-chat-bubble-component.test.mjs test/fetch-chat-list-command-parse.test.mjs test/fetch-private-messages-command.test.mjs
```

Expected: PASS

- [ ] **Step 5: Commit the implementation**

Run:
```bash
git add idframework/components/id-chat-groupmsg-list.js idframework/stores/chat/simple-talk.js demo-chat/chat.js test/id-chat-groupmsg-list-component.test.mjs test/simple-talk-store-private-decrypt.test.mjs
git commit -m "fix: restore private chat decrypt flow in demo chat"
```

- [ ] **Step 6: Publish the implementation dev diary buzz**

Run:
```bash
cat > /tmp/demo-chat-private-decrypt-impl-buzz.json <<'EOF'
{
  "content": "Dev diary: fixed the demo-chat private decryption path. The message list now syncs active private-chat context into SimpleTalkStore, and the private decrypt helper now resolves peer identity and chatPublicKey from real message payloads before falling back to remote user lookup. This restores both thread rendering and sidebar preview decryption while keeping encrypted payloads unchanged in store state."
}
EOF
metabot buzz post --request-file /tmp/demo-chat-private-decrypt-impl-buzz.json
```
