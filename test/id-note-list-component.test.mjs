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
            .replace(/>/g, '&gt;');
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
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    disconnect() {}
  };
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
    IDFramework: {
      I18n: {
        t(_key, _params, fallback) {
          return fallback || '';
        },
      },
      IDController: {
        commands: new Map(),
        builtInCommands: new Map(),
      },
      async dispatch() {
        throw new Error('dispatch should not be called in this unit test');
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
    note: {
      route: { path: '/', view: 'list', params: {}, query: {} },
      publicList: { items: [], cursor: 0, hasMore: false, isLoading: false, error: '' },
      myList: { items: [], cursor: 0, hasMore: false, isLoading: false, error: '' },
    },
  };
}

test('id-note-list renders empty state when list has no items', async () => {
  const stores = createStores();
  const registry = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=empty-public');
  const Ctor = registry.get('id-note-list');
  assert.ok(Ctor, 'id-note-list should be registered');

  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /No notes/);
});

test('id-note-list renders note cards when items exist', async () => {
  const stores = createStores();
  stores.note.publicList.items = [
    { pin: { id: 'pin_1' }, noteData: { title: 'Note A', subtitle: '', tags: [], attachments: [], encryption: '0', coverImg: '' } },
    { pin: { id: 'pin_2' }, noteData: { title: 'Note B', subtitle: 'Sub', tags: ['x'], attachments: ['metafile://1'], encryption: '1', coverImg: '' } },
  ];
  const registry = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=cards-public');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /id-note-card/);
  assert.match(html, /Note A/);
  assert.match(html, /Note B/);
});

test('id-note-list escapes JSON payloads before embedding them in note attributes', async () => {
  const stores = createStores();
  stores.note.publicList.items = [
    {
      pin: { id: 'pin_1', address: '1abc' },
      noteData: {
        title: 'Quoted "Note"',
        subtitle: '',
        content: 'Body',
        tags: [],
        attachments: [],
        encryption: '0',
        coverImg: '',
      },
    },
  ];
  const registry = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=cards-attr-escape');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /note="\{&quot;pin&quot;:/);
  assert.match(html, /Quoted \\&quot;Note\\&quot;/);
});
