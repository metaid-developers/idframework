import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv() {
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

    hasAttribute(name) {
      return this._attrs.has(String(name));
    }

    removeAttribute(name) {
      const key = String(name);
      const oldValue = this._attrs.has(key) ? this._attrs.get(key) : null;
      this._attrs.delete(key);
      if (typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(key, oldValue, null);
      }
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
    location: { protocol: 'https:' },
  };

  return registry;
}

test('id-avatar registers and renders fallback initial', { concurrency: false }, async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-avatar.js?case=avatar-register');

  const IdAvatar = registry.get('id-avatar');
  assert.ok(IdAvatar, 'id-avatar should be registered');

  const instance = new IdAvatar();
  instance.setAttribute('name', 'Alice');
  instance.setAttribute('size', '36');
  instance.connectedCallback();

  assert.match(instance.shadowRoot.innerHTML, /Alice|A/);
  assert.match(instance.shadowRoot.innerHTML, /36/);
});

test('id-avatar treats empty metafile content URL as unusable image source', { concurrency: false }, async () => {
  const IdAvatar = globalThis.customElements && globalThis.customElements.get('id-avatar');
  assert.ok(IdAvatar, 'id-avatar should be registered before fallback URL test');
  const instance = new IdAvatar();
  instance.setAttribute('name', 'Bob');
  instance.setAttribute('src', 'https://file.metaid.io/metafile-indexer/content/');
  instance.connectedCallback();

  assert.ok(!instance.shadowRoot.innerHTML.includes('class="image"'));
  assert.ok(instance.shadowRoot.innerHTML.includes('class="fallback"'));
});
