import test from 'node:test';
import assert from 'node:assert/strict';

function createDocumentStub() {
  return {
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
      this._attrs = new Map();
      this.shadowRoot = null;
      this.isConnected = false;
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
    define(name, ctor) {
      registry.set(name, ctor);
    },
    get(name) {
      return registry.get(name);
    },
  };
  globalThis.document = createDocumentStub();
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/' },
    history: { pushState() {}, replaceState() {} },
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

  return registry;
}

function createStores(view) {
  return {
    app: { route: { path: '/', view: view || 'list', params: {}, query: {} } },
    note: { route: { path: '/', view: view || 'list', params: { id: 'pin_123' }, query: {} } },
  };
}

test('id-note-shell selects list mynote draft detail editor views from route store', async () => {
  const viewToExpected = new Map([
    ['list', 'id-note-list'],
    ['mynote', 'id-note-list'],
    ['draft', 'id-note-draft-list'],
    ['detail', 'id-note-detail'],
    ['editor', 'id-note-editor'],
  ]);

  for (const [view, expectedTag] of viewToExpected.entries()) {
    const stores = createStores(view);
    const registry = setupEnv(stores);

    await import('../idframework/components/id-note-shell.js?case=' + view);
    const Ctor = registry.get('id-note-shell');
    assert.ok(Ctor, 'id-note-shell should be registered');

    const instance = new Ctor();
    instance.connectedCallback();

    const html = instance.shadowRoot.innerHTML;
    assert.match(html, /id-note-nav/);
    assert.match(html, new RegExp(expectedTag));
  }
});

