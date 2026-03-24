import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv(stores, locationOverrides = {}) {
  const registry = new Map();
  const pushCalls = [];
  const replaceCalls = [];

  class MockHTMLElement {
    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
        querySelectorAll: () => [],
      };
      return this.shadowRoot;
    }

    dispatchEvent() {
      return true;
    }
  }

  globalThis.HTMLElement = MockHTMLElement;
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

  globalThis.document = {
    addEventListener() {},
    removeEventListener() {},
  };

  globalThis.window = {
    location: {
      pathname: '/buzz/app/index.html',
      hash: '#/home/new',
      search: '',
      protocol: 'https:',
      ...locationOverrides,
    },
    history: {
      pushState(_state, _title, url) {
        pushCalls.push(url);
        applyBrowserUrl(globalThis.window.location, url);
      },
      replaceState(_state, _title, url) {
        replaceCalls.push(url);
        applyBrowserUrl(globalThis.window.location, url);
      },
    },
    addEventListener() {},
    removeEventListener() {},
    IDFramework: {
      I18n: {
        t(_key, _params, fallback) {
          return fallback || '';
        },
      },
    },
  };

  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  return { registry, pushCalls, replaceCalls };
}

function applyBrowserUrl(location, url) {
  const text = String(url || '');
  const hashIndex = text.indexOf('#');
  const pathAndSearch = hashIndex >= 0 ? text.slice(0, hashIndex) : text;
  const searchIndex = pathAndSearch.indexOf('?');

  location.pathname = searchIndex >= 0 ? pathAndSearch.slice(0, searchIndex) : pathAndSearch;
  location.search = searchIndex >= 0 ? pathAndSearch.slice(searchIndex) : '';
  location.hash = hashIndex >= 0 ? text.slice(hashIndex) : '';
}

function createStores() {
  return {
    app: {
      route: {
        path: '/home/new',
        params: { tab: 'new' },
      },
      buzzTab: 'new',
      profileMetaid: '',
    },
    wallet: {
      isConnected: false,
      address: '',
    },
  };
}

let cachedCtor = null;
async function loadComponent(registry) {
  if (!cachedCtor) {
    await import('../idframework/components/id-buzz-tabs.js');
    cachedCtor = registry.get('id-buzz-tabs') || globalThis.customElements.get('id-buzz-tabs');
  }
  return cachedCtor;
}

test('id-buzz-tabs reads hash route from arbitrary index.html deployments', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores, {
    pathname: '/buzz/app/index.html',
    hash: '#/home/hot',
  });
  const IdBuzzTabs = await loadComponent(registry);
  const instance = new IdBuzzTabs();

  assert.equal(instance._getRoutePathFromLocation(), '/home/hot');
});

test('id-buzz-tabs pushes hash url instead of root path for arbitrary index.html deployments', async () => {
  const stores = createStores();
  const { registry, pushCalls } = setupEnv(stores, {
    pathname: '/buzz/app/index.html',
    hash: '#/home/new',
  });
  const IdBuzzTabs = await loadComponent(registry);
  const instance = new IdBuzzTabs();

  instance._onTabClick('hot');

  assert.deepEqual(pushCalls, ['/buzz/app/index.html#/home/hot']);
  assert.equal(stores.app.route.path, '/home/hot');
  assert.equal(stores.app.buzzTab, 'hot');
});
