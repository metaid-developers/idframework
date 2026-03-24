import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv(stores) {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
    }

    setAttribute(name, value) {
      this._attrs.set(String(name), String(value));
    }

    getAttribute(name) {
      return this._attrs.has(String(name)) ? this._attrs.get(String(name)) : null;
    }

    hasAttribute(name) {
      return this._attrs.has(String(name));
    }

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
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

  globalThis.window = {
    location: {
      protocol: 'https:',
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
    wallet: {
      isConnected: true,
      address: '1viewer',
      metaid: '',
    },
    user: {
      user: {
        metaid: '',
        address: '1viewer',
      },
    },
    buzz: {
      followRelation: {
        byTarget: {},
      },
    },
  };
}

let cachedCtor = null;
async function loadComponent(registry, suffix) {
  if (!cachedCtor || suffix) {
    await import('../idframework/components/id-follow-button.js' + (suffix || ''));
    cachedCtor = registry.get('id-follow-button');
  }
  return cachedCtor;
}

test('id-follow-button hides when target-metaid is missing', async () => {
  const stores = createStores();
  const registry = setupEnv(stores);
  const IdFollowButton = await loadComponent(registry, '?case=missing-target');
  const instance = new IdFollowButton();

  instance.render();
  assert.match(instance.shadowRoot.innerHTML, /display:none/);
});

test('id-follow-button shows You tag when target is self', async () => {
  const stores = createStores();
  stores.user.user.metaid = 'a'.repeat(64);
  stores.wallet.metaid = 'a'.repeat(64);
  const registry = setupEnv(stores);
  const IdFollowButton = await loadComponent(registry);
  const instance = new IdFollowButton();
  instance.setAttribute('target-metaid', 'a'.repeat(64));

  instance._ensureStoreShape();
  instance._bindState();
  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /You/);
});
