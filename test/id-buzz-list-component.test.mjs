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

function createBuzzItem(id, content) {
  return {
    id: id,
    lastId: id,
    content: content,
    timestamp: 1711000000000,
    attachments: [],
    userInfo: {
      name: 'Alice',
      metaId: 'metaid_alice',
      avatar: '',
      address: '1alice',
    },
  };
}

function createStores() {
  return {
    app: {
      route: {
        path: '/home/hot',
        params: { tab: 'hot' },
      },
      buzzTab: 'hot',
      profileMetaid: '',
    },
    wallet: {
      isConnected: false,
      address: '',
    },
    user: {
      user: {},
    },
    buzz: {
      pageSize: 2,
      reportedRecommendIds: {},
      profile: { byMetaid: {} },
      tabs: {
        new: { list: [], nextCursor: '', hasMore: true, isLoading: false, error: '', total: 0 },
        hot: {
          list: [
            createBuzzItem('pin_1', 'first'),
            createBuzzItem('pin_2', 'second'),
          ],
          nextCursor: 'pin_2',
          hasMore: true,
          isLoading: false,
          error: '',
          total: 2,
        },
        following: { list: [], nextCursor: '', hasMore: true, isLoading: false, error: '', total: 0 },
        recommend: { list: [], nextCursor: '', hasMore: true, isLoading: false, error: '', total: 0 },
      },
    },
  };
}

function setupEnv(stores, result) {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this.shadowRoot = null;
      this._attrs = new Map();
      this.isConnected = false;
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
      this._attrs.set(String(name), String(value));
    }

    getAttribute(name) {
      return this._attrs.get(String(name)) || null;
    }

    dispatchEvent() {
      return true;
    }
  }

  globalThis.HTMLElement = MockHTMLElement;
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    disconnect() {}
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = !!init.bubbles;
      this.composed = !!init.composed;
    }
  };
  globalThis.customElements = {
    define(name, klass) {
      registry.set(name, klass);
    },
    get(name) {
      return registry.get(name);
    },
  };
  globalThis.document = createDocumentStub();
  globalThis.window = {
    location: {
      pathname: '/demo-buzz/index.html',
      hash: '#/home/hot',
      search: '',
      protocol: 'https:',
    },
    history: {
      pushState() {},
      replaceState() {},
    },
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    IDFramework: {
      I18n: {
        t(_key, _params, fallback) {
          return fallback || '';
        },
      },
      IDController: {
        commands: new Map([['fetchBuzz', '@idf/commands/FetchBuzzCommand.js']]),
        builtInCommands: new Map(),
      },
      async dispatch(commandName) {
        assert.equal(commandName, 'fetchBuzz');
        return result;
      },
    },
  };

  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  return registry;
}

test('id-buzz-list stops hot pagination when the next page only repeats existing items', async () => {
  const stores = createStores();
  const duplicatePage = {
    list: [
      createBuzzItem('pin_1', 'first'),
      createBuzzItem('pin_2', 'second'),
    ],
    total: 2,
    nextCursor: 'pin_2',
    hasMore: true,
  };
  const registry = setupEnv(stores, duplicatePage);
  await import('../idframework/components/id-buzz-list.js?case=stop-hot-pagination-on-duplicates');
  const IdBuzzList = registry.get('id-buzz-list');
  const instance = new IdBuzzList();

  instance._syncViewFromStoreSegment();
  await instance._fetchBuzz(true);

  assert.equal(stores.buzz.tabs.hot.list.length, 2);
  assert.deepEqual(
    stores.buzz.tabs.hot.list.map((item) => item.id),
    ['pin_1', 'pin_2']
  );
  assert.equal(stores.buzz.tabs.hot.hasMore, false);
  assert.equal(stores.buzz.tabs.hot.nextCursor, '');
  assert.match(instance.shadowRoot.innerHTML, /No more content\./);
});

test('id-buzz-list keeps the full hot batch when the API returns more than the local page size', async () => {
  const stores = createStores();
  const hotBatch = Array.from({ length: 30 }, (_value, index) => (
    createBuzzItem('pin_' + String(index + 1), 'post-' + String(index + 1))
  ));
  const firstPage = {
    list: hotBatch,
    total: 30,
    nextCursor: '69c27ff5db1457ee96f5cc9b',
    hasMore: true,
  };
  const registry = setupEnv(stores, firstPage);
  await import('../idframework/components/id-buzz-list.js?case=keep-full-hot-batch');
  const IdBuzzList = registry.get('id-buzz-list');
  const instance = new IdBuzzList();

  await instance._fetchBuzz(false);

  assert.equal(stores.buzz.tabs.hot.list.length, 30);
  assert.equal(stores.buzz.tabs.hot.hasMore, false);
  assert.equal(stores.buzz.tabs.hot.nextCursor, '');
  assert.match(instance.shadowRoot.innerHTML, /post-30/);
});
