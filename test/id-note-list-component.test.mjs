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
  const dispatchCalls = [];

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
      async dispatch(eventName, payload) {
        dispatchCalls.push({ eventName, payload });
        return { ok: true };
      },
    },
  };
  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  return { registry, dispatchCalls };
}

function createStores() {
  return {
    wallet: { address: '1owner' },
    user: { user: { address: '1owner' } },
    note: {
      route: { path: '/', view: 'list', params: {}, query: {} },
      publicList: { items: [], cursor: 0, hasMore: false, isLoading: false, error: '', page: 1, pageSize: 20, currentCursor: '0', cursorHistory: ['0'] },
      myList: { items: [], cursor: 0, hasMore: false, isLoading: false, error: '', page: 1, pageSize: 20, currentCursor: '0', cursorHistory: ['0'] },
    },
  };
}

test('id-note-list renders empty state when list has no items', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);

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
  const { registry } = setupEnv(stores);

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
  const { registry } = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=cards-attr-escape');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /note="\{&quot;pin&quot;:/);
  assert.match(html, /Quoted \\&quot;Note\\&quot;/);
});

test('id-note-list renders pager controls and dispatches next-page fetch in public mode', async () => {
  const stores = createStores();
  stores.note.publicList = {
    items: [
      { pin: { id: 'pin_1' }, noteData: { title: 'Note A', subtitle: '', tags: [], attachments: [], encryption: '0', coverImg: '' } },
    ],
    cursor: 'cursor-2',
    hasMore: true,
    isLoading: false,
    error: '',
    page: 1,
    pageSize: 20,
    currentCursor: '0',
    cursorHistory: ['0'],
  };
  const { registry, dispatchCalls } = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=pager-public');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /data-action="prev"/);
  assert.match(html, /data-action="next"/);
  assert.match(html, /Page 1/);

  await instance._changePage('next');

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0].eventName, 'fetchNoteList');
  assert.deepEqual(dispatchCalls[0].payload, {
    cursor: 'cursor-2',
    replace: true,
    page: 2,
    pageSize: 20,
    size: 20,
    currentCursor: 'cursor-2',
    cursorHistory: ['0', 'cursor-2'],
  });
});

test('id-note-list dispatches previous-page fetch in my-note mode using the resolved wallet address', async () => {
  const stores = createStores();
  stores.note.myList = {
    items: [
      { pin: { id: 'pin_2' }, noteData: { title: 'My note', subtitle: '', tags: [], attachments: [], encryption: '0', coverImg: '' } },
    ],
    cursor: 'cursor-3',
    hasMore: true,
    isLoading: false,
    error: '',
    page: 2,
    pageSize: 20,
    currentCursor: 'cursor-2',
    cursorHistory: ['0', 'cursor-2'],
  };
  const { registry, dispatchCalls } = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=pager-my');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'my');
  instance.connectedCallback();

  await instance._changePage('prev');

  assert.equal(dispatchCalls.length, 1);
  assert.equal(dispatchCalls[0].eventName, 'fetchMyNoteList');
  assert.deepEqual(dispatchCalls[0].payload, {
    address: '1owner',
    cursor: '0',
    replace: true,
    page: 1,
    pageSize: 20,
    size: 20,
    currentCursor: '0',
    cursorHistory: ['0'],
  });
});

test('id-note-list disables pager controls at list boundaries', async () => {
  const stores = createStores();
  stores.note.publicList = {
    items: [
      { pin: { id: 'pin_1' }, noteData: { title: 'Note A', subtitle: '', tags: [], attachments: [], encryption: '0', coverImg: '' } },
    ],
    cursor: '',
    hasMore: false,
    isLoading: false,
    error: '',
    page: 1,
    pageSize: 20,
    currentCursor: '0',
    cursorHistory: ['0'],
  };
  const { registry } = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=pager-disabled');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /data-action="prev"[^>]*disabled/);
  assert.match(html, /data-action="next"[^>]*disabled/);
});

test('id-note-list ignores pager requests while loading', async () => {
  const stores = createStores();
  stores.note.publicList = {
    items: [
      { pin: { id: 'pin_1' }, noteData: { title: 'Note A', subtitle: '', tags: [], attachments: [], encryption: '0', coverImg: '' } },
    ],
    cursor: 'cursor-2',
    hasMore: true,
    isLoading: true,
    error: '',
    page: 1,
    pageSize: 20,
    currentCursor: '0',
    cursorHistory: ['0'],
  };
  const { registry, dispatchCalls } = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=pager-loading-guard');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'public');
  instance.connectedCallback();

  await instance._changePage('next');

  assert.equal(dispatchCalls.length, 0);
  assert.match(instance.shadowRoot.innerHTML, /data-action="next"[^>]*disabled/);
});

test('id-note-list disables my-note pager actions when no address is available', async () => {
  const stores = createStores();
  stores.wallet.address = '';
  stores.user.user.address = '';
  stores.note.myList = {
    items: [
      { pin: { id: 'pin_2' }, noteData: { title: 'My note', subtitle: '', tags: [], attachments: [], encryption: '0', coverImg: '' } },
    ],
    cursor: 'cursor-3',
    hasMore: true,
    isLoading: false,
    error: '',
    page: 2,
    pageSize: 20,
    currentCursor: 'cursor-2',
    cursorHistory: ['0', 'cursor-2'],
  };
  const { registry, dispatchCalls } = setupEnv(stores);

  await import('../idframework/components/id-note-list.js?case=pager-my-no-address');
  const Ctor = registry.get('id-note-list');
  const instance = new Ctor();
  instance.setAttribute('mode', 'my');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /data-action="prev"[^>]*disabled/);
  assert.match(html, /data-action="next"[^>]*disabled/);

  await instance._changePage('prev');
  await instance._changePage('next');

  assert.equal(dispatchCalls.length, 0);
});
