import test from 'node:test';
import assert from 'node:assert/strict';

function createDocumentStub() {
  return {
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
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
}

function setupEnv(stores) {
  const registry = globalThis.__chatPanelRegistry || new Map();
  globalThis.__chatPanelRegistry = registry;

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
    }

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      return this.shadowRoot;
    }

    setAttribute(name, value) {
      const key = String(name);
      const oldValue = this._attrs.has(key) ? this._attrs.get(key) : null;
      const nextValue = String(value);
      this._attrs.set(key, nextValue);
      if (typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(key, oldValue, nextValue);
      }
    }

    getAttribute(name) {
      const key = String(name);
      return this._attrs.has(key) ? this._attrs.get(key) : null;
    }
  }

  globalThis.HTMLElement = MockHTMLElement;
  if (!globalThis.customElements) {
    globalThis.customElements = {
      define(name, klass) {
        registry.set(name, klass);
      },
      get(name) {
        return registry.get(name);
      },
    };
  }

  globalThis.document = createDocumentStub();
  globalThis.window = {};
  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };
  globalThis.requestAnimationFrame = (fn) => fn();

  return registry;
}

test('id-chat-chatlist-panel renders avatar component and mention badge', async () => {
  const stores = {
    chat: {
      currentConversation: '',
      conversations: {
        peer_1: {
          type: '2',
          participantMetaId: 'peer_1',
          name: 'Alice',
          avatar: '',
          index: 12,
          unreadCount: 0,
          unreadMentionCount: 2,
          lastMessage: 'hello',
          lastMessageTime: Date.now(),
        },
      },
      isLoading: false,
      error: null,
    },
    user: {
      users: {
        peer_1: {
          name: 'Alice',
          avatarUrl: 'https://example.com/avatar.png',
        },
      },
    },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-chatlist-panel.js?case=render-avatar-mention');
  const Panel = registry.get('id-chat-chatlist-panel');
  const instance = new Panel();
  instance.render();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /id-avatar/);
  assert.match(html, /chatlist-item-mention/);
  assert.match(html, />@2</);
});

test('id-chat-chatlist-panel signature includes mention count deltas', async () => {
  const stores = {
    chat: {
      currentConversation: 'peer_1',
      conversations: {
        peer_1: {
          type: '2',
          participantMetaId: 'peer_1',
          unreadCount: 1,
          unreadMentionCount: 0,
          lastMessage: 'hello',
          lastMessageTime: Date.now(),
        },
      },
      isLoading: false,
      error: null,
    },
    user: { users: {} },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-chatlist-panel.js?case=signature-mention');
  const Panel = registry.get('id-chat-chatlist-panel');
  const instance = new Panel();

  const before = instance._buildStoreSignature();
  stores.chat.conversations.peer_1.unreadMentionCount = 3;
  const after = instance._buildStoreSignature();

  assert.notEqual(before, after);
});

test('id-chat-chatlist-panel renders formatted time in conversation meta', async () => {
  const stores = {
    chat: {
      currentConversation: '',
      conversations: {
        peer_2: {
          type: '2',
          participantMetaId: 'peer_2',
          name: 'Bob',
          unreadCount: 1,
          unreadMentionCount: 0,
          lastMessage: 'ping',
          lastMessageTime: Date.now(),
        },
      },
      isLoading: false,
      error: null,
    },
    user: { users: {} },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-chatlist-panel.js?case=time-render');
  const Panel = registry.get('id-chat-chatlist-panel');
  const instance = new Panel();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /chatlist-item-time/);
  assert.match(instance.shadowRoot.innerHTML, /chatlist-item-time[^>]*>[^<]*:[^<]*</);
});

test('id-chat-chatlist-panel keeps conversation items visible while loading messages', async () => {
  const stores = {
    chat: {
      currentConversation: 'peer_3',
      conversations: {
        peer_3: {
          type: '2',
          participantMetaId: 'peer_3',
          name: 'Carol',
          unreadCount: 0,
          unreadMentionCount: 0,
          lastMessage: 'hey there',
          lastMessageTime: Date.now(),
        },
      },
      isLoading: true,
      error: null,
    },
    user: { users: {} },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-chatlist-panel.js?case=loading-with-data');
  const Panel = registry.get('id-chat-chatlist-panel');
  const instance = new Panel();
  instance.render();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /data-metaid="peer_3"/);
  assert.doesNotMatch(html, /No conversations yet/);
  assert.match(html, /loading-inline/);
});
