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

function setupEnv(stores, hashPath) {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
      this.isConnected = false;
    }

    setAttribute(name, value) {
      this._attrs.set(String(name), String(value));
    }

    getAttribute(name) {
      return this._attrs.get(String(name)) || null;
    }

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
      hash: hashPath || '#/profile/target_metaid',
      search: '',
      protocol: 'https:',
    },
    history: {
      pushState() {},
      replaceState() {},
    },
    IDFramework: {
      IDController: {
        commands: new Map(),
        builtInCommands: new Map(),
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

function createStores() {
  return {
    app: {
      route: {
        path: '/profile/target_metaid',
        params: { metaid: 'target_metaid' },
      },
      profileMetaid: 'target_metaid',
    },
    buzz: {
      pageSize: 10,
      userList: {
        byMetaid: {},
      },
      profileHeader: {
        byMetaid: {
          target_metaid: {
            followingTotal: 7,
            followerTotal: 12,
          },
        },
      },
    },
  };
}

let cachedCtor = null;
async function loadComponent(registry, suffix) {
  if (!cachedCtor || suffix) {
    await import('../idframework/components/id-user-list.js' + (suffix || ''));
    cachedCtor = registry.get('id-user-list');
  }
  return cachedCtor;
}

test('id-user-list registers and stays hidden by default in profile mode', async () => {
  const stores = createStores();
  const registry = setupEnv(stores, '#/profile/target_metaid');
  const IdUserList = await loadComponent(registry, '?case=render-profile');
  assert.ok(IdUserList, 'id-user-list should be registered');

  const instance = new IdUserList();
  instance._ensureStoreShape();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /display:none/);
});

test('id-user-list hides when route is not profile mode', async () => {
  const stores = createStores();
  stores.app.route.path = '/home/new';
  stores.app.route.params = { tab: 'new' };
  stores.app.profileMetaid = '';

  const registry = setupEnv(stores, '#/home/new');
  const IdUserList = await loadComponent(registry, '?case=render-home');
  const instance = new IdUserList();
  instance._ensureStoreShape();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /display:none/);
});

test('id-user-list creates per-profile list state with following/followers segments', async () => {
  const stores = createStores();
  const registry = setupEnv(stores, '#/profile/target_metaid');
  const IdUserList = await loadComponent(registry, '?case=store-shape');
  const instance = new IdUserList();

  instance._ensureStoreShape();
  const segment = instance._ensureProfileSegment('target_metaid');

  assert.equal(segment.activeType, 'following');
  assert.equal(segment.panelOpen, false);
  assert.ok(Array.isArray(segment.following.list));
  assert.ok(Array.isArray(segment.followers.list));
  assert.equal(segment.following.hasLoaded, false);
  assert.equal(segment.followers.hasLoaded, false);
});

test('id-user-list renders panel when panelOpen=true', async () => {
  const stores = createStores();
  const registry = setupEnv(stores, '#/profile/target_metaid');
  const IdUserList = await loadComponent(registry, '?case=panel-open');
  const instance = new IdUserList();

  instance._ensureStoreShape();
  const segment = instance._ensureProfileSegment('target_metaid');
  segment.panelOpen = true;
  instance._syncViewFromStore();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /role="dialog"/);
  assert.match(instance.shadowRoot.innerHTML, /Close/);
  assert.match(instance.shadowRoot.innerHTML, /Following/);
  assert.match(instance.shadowRoot.innerHTML, /Followers/);
});

test('id-user-list renders follow button for rows with metaid', async () => {
  const stores = createStores();
  const registry = setupEnv(stores, '#/profile/target_metaid');
  const IdUserList = await loadComponent(registry, '?case=row-follow-button');
  const instance = new IdUserList();

  instance._ensureStoreShape();
  const segment = instance._ensureProfileSegment('target_metaid');
  segment.panelOpen = true;
  segment.following.list = [
    {
      id: 'r1',
      metaid: 'a'.repeat(64),
      address: '1alice',
      name: 'Alice',
      avatar: '',
    },
  ];
  segment.following.hasLoaded = true;
  segment.following.total = 1;
  instance._syncViewFromStore();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /id-follow-button/);
  assert.match(instance.shadowRoot.innerHTML, /target-metaid/);
});
