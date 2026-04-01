import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv(options = {}) {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
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
    ServiceLocator: {
      metafs: 'https://mock.metafs.local/api',
    },
  };

  if (options.noMarked) {
    globalThis.marked = undefined;
  } else if (options.marked) {
    globalThis.marked = options.marked;
  } else {
    // Stub marked renderer so the component can call marked.parse().
    globalThis.marked = {
      parse(value) {
        return '<div class="marked">' + String(value || '') + '</div>';
      },
    };
  }

  return registry;
}

function setupMarkdownEditorEnv() {
  const registry = new Map();
  const scripts = [];

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
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
      const textarea = {
        value: '',
        placeholder: '',
        style: {},
        oninput: null,
      };
      const host = {};
      this.shadowRoot = {
        innerHTML: '',
        querySelector(selector) {
          if (selector === 'textarea') return textarea;
          if (selector === '.host') return host;
          return null;
        },
        querySelectorAll() {
          return [];
        },
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
    createElement(tag) {
      if (tag === 'script') {
        return {
          dataset: {},
          setAttribute(name, value) {
            if (name === 'data-idf-vditor') this.dataset.idfVditor = value;
          },
          onload: null,
          onerror: null,
          src: '',
        };
      }
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
    querySelector(selector) {
      if (selector === 'script[data-idf-vditor]') {
        return scripts[0] || null;
      }
      return null;
    },
    head: {
      appendChild(node) {
        scripts.push(node);
        return node;
      },
    },
    body: {
      appendChild(node) {
        scripts.push(node);
        return node;
      },
    },
    documentElement: {
      appendChild(node) {
        scripts.push(node);
        return node;
      },
    },
  };

  globalThis.window = {};

  return { registry, scripts };
}

test('id-note-markdown-view replaces metafile placeholders with resolved URLs', { concurrency: false }, async () => {
  const registry = setupEnv();

  await import('../idframework/components/id-note-markdown-view.js?case=markdown-view-metafile-replace');
  const Ctor = registry.get('id-note-markdown-view');
  assert.ok(Ctor, 'id-note-markdown-view should be registered');

  const pinId = 'a'.repeat(64) + 'i0';
  const metafileUri = 'metafile://image/' + pinId + '.png';
  const expectedUrl = 'https://mock.metafs.local/api/v1/files/content/' + encodeURIComponent(pinId);

  const instance = new Ctor();
  instance.setAttribute(
    'content',
    '![cover]({{attachment-0}})\n\n[raw](' + metafileUri + ')',
  );
  instance.setAttribute('attachments', JSON.stringify([metafileUri]));
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, new RegExp(expectedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.ok(html.indexOf(expectedUrl) !== -1, 'expected resolved URL to appear in rendered output');
});

test('id-note-markdown-view strips unquoted javascript: href/src after marked render', { concurrency: false }, async () => {
  const registry = setupEnv({
    marked: {
      parse() {
        return [
          '<a href=javascript:alert(1)>bad</a>',
          '<img src=javascript:alert(2)>',
          '<a href=\"javascript:alert(3)\">bad2</a>',
        ].join('');
      },
    },
  });

  await import('../idframework/components/id-note-markdown-view.js?case=markdown-view-sanitize-js-url');
  const Ctor = registry.get('id-note-markdown-view');
  const instance = new Ctor();
  instance.setAttribute('content', 'ignored');
  instance.setAttribute('attachments', JSON.stringify([]));
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.equal(html.toLowerCase().indexOf('javascript:'), -1);
  assert.match(html, /href="#"/);
  assert.match(html, /src=""/);
});

test('id-note-markdown-view falls back to <pre> when marked is missing', { concurrency: false }, async () => {
  const registry = setupEnv({ noMarked: true });

  await import('../idframework/components/id-note-markdown-view.js?case=markdown-view-no-marked');
  const Ctor = registry.get('id-note-markdown-view');
  const instance = new Ctor();
  instance.setAttribute('content', '<b>raw</b>');
  instance.setAttribute('attachments', JSON.stringify([]));
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /<pre class="md-fallback">/);
  assert.equal(html.indexOf('<b>raw</b>'), -1);
  assert.ok(html.indexOf('&lt;b&gt;raw&lt;/b&gt;') !== -1);
});

test('id-note-markdown-view strips executable html before rendering markdown output', { concurrency: false }, async () => {
  const registry = setupEnv();

  await import('../idframework/components/id-note-markdown-view.js?case=markdown-view-sanitize');
  const Ctor = registry.get('id-note-markdown-view');
  assert.ok(Ctor, 'id-note-markdown-view should be registered');

  const instance = new Ctor();
  instance.setAttribute('content', '<img src="x" onerror="alert(1)">');
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.doesNotMatch(html, /onerror\s*=/i);
  assert.doesNotMatch(html, /alert\(1\)/i);
});

test('id-note-markdown-view exposes reusable color variables', { concurrency: false }, async () => {
  const registry = setupEnv();

  await import('../idframework/components/id-note-markdown-view.js?case=markdown-view-color-vars');
  const Ctor = registry.get('id-note-markdown-view');
  const instance = new Ctor();
  instance.setAttribute('content', 'contrast test');
  instance.setAttribute('attachments', JSON.stringify([]));
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /var\(--note-markdown-text/);
  assert.match(html, /var\(--note-markdown-link/);
  assert.match(html, /var\(--note-markdown-code-bg/);
});

test('id-note-markdown-editor upgrades all concurrent instances once Vditor finishes loading', { concurrency: false }, async () => {
  const { registry, scripts } = setupMarkdownEditorEnv();

  await import('../idframework/components/id-note-markdown-editor.js?case=markdown-editor-concurrent');
  const Ctor = registry.get('id-note-markdown-editor');
  assert.ok(Ctor, 'id-note-markdown-editor should be registered');

  const first = new Ctor();
  const second = new Ctor();
  first.connectedCallback();
  second.connectedCallback();

  assert.equal(scripts.length, 1);
  assert.equal(first._vditor, null);
  assert.equal(second._vditor, null);

  globalThis.window.Vditor = function FakeVditor() {
    return {
      setValue() {},
      destroy() {},
    };
  };
  scripts[0].onload();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.ok(first._vditor, 'first editor should upgrade after script load');
  assert.ok(second._vditor, 'second editor should also upgrade after script load');
});

test('id-note-detail renders markdown content, chain attachments, and owner edit action', { concurrency: false }, async () => {
  const registry = setupEnv();
  const stores = {
    note: {
      detail: {
        pinId: 'note-pin-9',
        pin: { id: 'note-pin-9', address: '1owner' },
        author: { name: 'Alice' },
        noteData: {
          title: 'Rendered note',
          subtitle: 'With attachments',
          content: '# Title',
          attachments: ['metafile://image/' + 'b'.repeat(64) + 'i0' + '.png'],
          tags: ['demo'],
          encryption: '0',
        },
        isLoading: false,
        error: '',
      },
    },
    wallet: {
      address: '1owner',
    },
    user: {
      user: { address: '1owner' },
    },
  };

  globalThis.window = {
    ServiceLocator: {
      metafs: 'https://mock.metafs.local/api',
    },
    addEventListener() {},
    removeEventListener() {},
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/note/note-pin-9' },
    history: { pushState() {} },
  };
  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  await import('../idframework/components/id-note-markdown-view.js?case=detail-markdown-view');
  await import('../idframework/components/id-note-detail.js?case=detail-render');
  const Ctor = registry.get('id-note-detail');
  assert.ok(Ctor, 'id-note-detail should be registered');

  const instance = new Ctor();
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /Rendered note/);
  assert.match(html, /Alice/);
  assert.match(html, /class="body-shell"/);
  assert.match(html, /--note-markdown-bg:/);
  assert.match(html, /--note-markdown-code-bg:/);
  assert.match(html, /id-note-markdown-view/);
  assert.match(html, /files\/content/);
  assert.match(html, /Edit/);
});

test('id-note-detail wraps content in a contrast body shell with reusable variables', { concurrency: false }, async () => {
  const registry = setupEnv();
  const stores = {
    note: {
      detail: {
        pinId: 'note-pin-contrast',
        pin: { id: 'note-pin-contrast', address: '1owner' },
        author: { name: 'Contrast' },
        noteData: {
          title: 'Readable note',
          content: '# Contrast',
          attachments: [],
          tags: [],
          encryption: '0',
        },
        isLoading: false,
        error: '',
      },
    },
    wallet: {
      address: '1owner',
    },
    user: {
      user: { address: '1owner' },
    },
  };

  globalThis.window = {
    ServiceLocator: {
      metafs: 'https://mock.metafs.local/api',
    },
    addEventListener() {},
    removeEventListener() {},
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/note/note-pin-contrast' },
    history: { pushState() {} },
  };
  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  await import('../idframework/components/id-note-markdown-view.js?case=detail-markdown-view-shell');
  await import('../idframework/components/id-note-detail.js?case=detail-body-shell');
  const Ctor = registry.get('id-note-detail');
  assert.ok(Ctor, 'id-note-detail should be registered for contrast shell');

  const instance = new Ctor();
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /class="body-shell"/);
  assert.match(html, /var\(--note-detail-body-bg/);
  assert.match(html, /id-note-markdown-view/);
});
