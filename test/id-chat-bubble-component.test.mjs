import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv() {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this.shadowRoot = null;
    }

    addEventListener() {}
    removeEventListener() {}

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
      };
      return this.shadowRoot;
    }
  }

  globalThis.HTMLElement = MockHTMLElement;
  globalThis.customElements = {
    define(name, klass) {
      registry.set(name, klass);
    },
    get(name) {
      return registry.get(name);
    },
  };
  globalThis.document = {
    createElement() {
      return {
        _text: '',
        set textContent(value) {
          this._text = value == null ? '' : String(value);
        },
        get innerHTML() {
          return this._text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        },
      };
    },
  };
  globalThis.window = {};

  return registry;
}

test('id-chat-bubble treats createGlobalMetaId/createMetaId as self identity', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-chat-bubble.js?case=self-detect');
  const IdChatBubble = registry.get('id-chat-bubble');
  const bubble = new IdChatBubble();

  bubble.currentUserGlobalMetaId = 'idq_self_global';
  bubble.currentUserMetaId = 'meta_self';

  assert.equal(
    bubble._isSelfMessage({
      createGlobalMetaId: 'idq_self_global',
      userInfo: { name: 'Me' },
    }),
    true
  );

  assert.equal(
    bubble._isSelfMessage({
      fromMetaId: 'meta_self',
      userInfo: { name: 'Me' },
    }),
    true
  );

  assert.equal(
    bubble._isSelfMessage({
      fromGlobalMetaId: 'idq_other',
      userInfo: { name: 'Other' },
    }),
    false
  );
});

test('id-chat-bubble applies btc/doge chain style for both self and other bubbles', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-chat-bubble.js?case=chain-style');
  const IdChatBubble = registry.get('id-chat-bubble');

  const otherBubble = new IdChatBubble();
  otherBubble.currentUserGlobalMetaId = 'idq_self_global';
  otherBubble.message = {
    id: 'msg_1',
    content: 'hello',
    timestamp: 1711000000,
    protocol: '/protocols/simplegroupchat',
    chain: 'btc',
    fromGlobalMetaId: 'idq_other',
    userInfo: { name: 'Other' },
  };
  assert.ok(otherBubble.shadowRoot.innerHTML.includes('class="bubble btc-item"'));

  const selfBubble = new IdChatBubble();
  selfBubble.currentUserGlobalMetaId = 'idq_self_global';
  selfBubble.message = {
    id: 'msg_2',
    content: 'self',
    timestamp: 1711000001,
    protocol: '/protocols/simplegroupchat',
    chain: 'doge',
    fromGlobalMetaId: 'idq_self_global',
    userInfo: { name: 'Me' },
  };
  assert.ok(selfBubble.shadowRoot.innerHTML.includes('class="bubble doge-item"'));
});

test('id-chat-bubble resolves unusable avatar path to fallback image', async () => {
  const registry = setupEnv();
  globalThis.window = {
    ServiceLocator: {
      metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
    },
  };
  await import('../idframework/components/id-chat-bubble.js?case=avatar-fallback');
  const IdChatBubble = registry.get('id-chat-bubble');
  const bubble = new IdChatBubble();

  const resolved = bubble._resolveAvatarUrl('/content/', 'seed-user');
  assert.ok(resolved.includes('api.dicebear.com/7.x/identicon/svg?seed=seed-user'));
});

test('id-chat-bubble resolves txid from txId/pinId/id fallback fields', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-chat-bubble.js?case=txid-fallback');
  const IdChatBubble = registry.get('id-chat-bubble');
  const bubble = new IdChatBubble();
  const txid = 'f'.repeat(64);

  assert.equal(
    bubble._resolveTxidFromMessage({ txId: txid }),
    txid
  );
  assert.equal(
    bubble._resolveTxidFromMessage({ pinId: `${txid}i0` }),
    txid
  );
  assert.equal(
    bubble._resolveTxidFromMessage({ id: `${txid}i0` }),
    txid
  );
});

test('id-chat-bubble renders optimistic failed state without tx toolbar and with retry button', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-chat-bubble.js?case=optimistic-failed');
  const IdChatBubble = registry.get('id-chat-bubble');
  const bubble = new IdChatBubble();

  bubble.currentUserGlobalMetaId = 'idq_self_global';
  bubble.message = {
    id: 'local_msg_1',
    content: 'hello optimistic',
    timestamp: 1711000001,
    protocol: '/protocols/simplegroupchat',
    fromGlobalMetaId: 'idq_self_global',
    userInfo: { name: 'Me' },
    _optimistic: true,
    _sendStatus: 'failed',
    _clientTempId: 'local_abc',
  };

  const html = bubble.shadowRoot.innerHTML;
  assert.ok(html.includes('send-state failed'));
  assert.ok(html.includes('data-action="retry-send"'));
  assert.equal(html.includes('data-action="tx"'), false);
});
