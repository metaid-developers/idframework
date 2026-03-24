import test from 'node:test';
import assert from 'node:assert/strict';

function createDocumentStub() {
  return {
    addEventListener() {},
    removeEventListener() {},
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
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
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

  globalThis.document = createDocumentStub();
  globalThis.window = {};
  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  return registry;
}

test('id-chat-header renders group chat title and status from chat store', async () => {
  const stores = {
    chat: {
      currentConversation: 'group_1',
      currentConversationType: '1',
      conversations: {
        group_1: {
          name: 'Core Group',
          avatar: 'https://example.com/group.png',
        },
      },
    },
    user: {
      users: {},
    },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-header.js?case=group-render');
  const IdChatHeader = registry.get('id-chat-header');
  const instance = new IdChatHeader();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /Core Group/);
  assert.match(instance.shadowRoot.innerHTML, /Group Chat/);
  assert.match(instance.shadowRoot.innerHTML, /id-avatar/);
});

test('id-chat-header prefers private user profile from user store', async () => {
  const stores = {
    chat: {
      currentConversation: 'peer_global',
      currentConversationType: '2',
      conversations: {
        peer_global: {
          name: 'Fallback Name',
          avatar: '',
        },
      },
    },
    user: {
      users: {
        peer_global: {
          name: 'Alice',
          avatarUrl: 'https://example.com/u.png',
        },
      },
    },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-header.js?case=private-render');
  const IdChatHeader = registry.get('id-chat-header');
  const instance = new IdChatHeader();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /Alice/);
  assert.match(instance.shadowRoot.innerHTML, /Private Chat/);
});

test('id-chat-header renders conversation drawer toggle action in header', async () => {
  const stores = {
    chat: {
      currentConversation: 'group_2',
      currentConversationType: '1',
      conversations: {
        group_2: {
          name: 'Design Group',
          avatar: '',
        },
      },
    },
    user: {
      users: {},
    },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-header.js?case=drawer-toggle');
  const IdChatHeader = registry.get('id-chat-header');
  const instance = new IdChatHeader();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /data-action="toggle-conversation-drawer"/);
  assert.match(instance.shadowRoot.innerHTML, /slot name="leading-action"/);
});

test('id-chat-header keeps action area visible without active conversation', async () => {
  const stores = {
    chat: {
      currentConversation: '',
      currentConversationType: '1',
      conversations: {},
    },
    user: {
      users: {},
    },
  };
  const registry = setupEnv(stores);

  await import('../idframework/components/id-chat-header.js?case=idle-actions');
  const IdChatHeader = registry.get('id-chat-header');
  const instance = new IdChatHeader();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /chat-header idle/);
  assert.match(instance.shadowRoot.innerHTML, /slot name="leading-action"/);
  assert.doesNotMatch(instance.shadowRoot.innerHTML, /toggle-conversation-drawer/);
});
