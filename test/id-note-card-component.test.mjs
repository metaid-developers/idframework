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

function setupEnv() {
  const registry = new Map();
  const previousCustomElements = globalThis.customElements;

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
  if (previousCustomElements && typeof previousCustomElements.get === 'function') {
    const existing = previousCustomElements.get('id-note-card');
    if (existing) registry.set('id-note-card', existing);
  }
  globalThis.document = createDocumentStub();
  globalThis.window = {
    IDFramework: {
      I18n: {
        t(_key, _params, fallback) {
          return fallback || '';
        },
      },
    },
  };

  return registry;
}

test('id-note-card renders title subtitle cover tags attachments and encrypted badge', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-note-card.js?case=render-card');
  const Ctor = registry.get('id-note-card');
  assert.ok(Ctor, 'id-note-card should be registered');

  const note = {
    pin: { id: 'pin_1' },
    noteData: {
      title: 'Hello World',
      subtitle: 'Subtitle',
      coverImg: 'https://example.com/cover.png',
      tags: ['t1', 't2'],
      attachments: ['metafile://a', 'metafile://b', 'metafile://c'],
      encryption: '1',
    },
  };

  const instance = new Ctor();
  instance.setAttribute('note', JSON.stringify(note));
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /Hello World/);
  assert.match(html, /Subtitle/);
  assert.ok(html.indexOf('example.com/cover.png') !== -1);
  assert.match(html, /t1/);
  assert.match(html, /t2/);
  assert.match(html, /Encrypted/);
  assert.match(html, /Attachments/);
  assert.match(html, /3/);
});

test('id-note-card resolves metafile cover images before rendering', async () => {
  const registry = setupEnv();
  globalThis.window.ServiceLocator = {
    metafs: 'https://mock.metafs.local/api',
  };

  await import(`../idframework/components/id-note-card.js?case=render-card-metafile-cover-${Date.now()}-${Math.random()}`);
  const Ctor = registry.get('id-note-card');
  assert.ok(Ctor, 'id-note-card should be registered');

  const note = {
    pin: { id: 'pin_2' },
    noteData: {
      title: 'With cover',
      subtitle: '',
      coverImg: 'metafile://image/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0.png',
      tags: [],
      attachments: [],
      encryption: '0',
    },
  };

  const instance = new Ctor();
  instance.setAttribute('note', JSON.stringify(note));
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.ok(html.includes('https://mock.metafs.local/api/v1/files/content/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefi0'));
  assert.equal(html.includes('metafile://image/'), false);
});
