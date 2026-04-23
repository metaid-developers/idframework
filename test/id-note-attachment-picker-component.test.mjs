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
    define(name, ctor) {
      registry.set(name, ctor);
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
    addEventListener() {},
    removeEventListener() {},
  };

  return registry;
}

test('id-note-attachment-picker previews local file rows and emits delete event', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-note-attachment-picker.js?case=picker-preview');
  const Ctor = registry.get('id-note-attachment-picker');
  assert.ok(Ctor, 'id-note-attachment-picker should be registered');

  const instance = new Ctor();
  const events = [];
  instance.dispatchEvent = (event) => {
    events.push(event);
    return true;
  };
  instance.items = [
    {
      mediaId: 'media-1',
      name: 'photo.png',
      type: 'image/png',
      blobUrl: 'blob:photo-1',
    },
  ];
  instance.connectedCallback();

  assert.match(instance.shadowRoot.innerHTML, /photo\.png/);
  assert.match(instance.shadowRoot.innerHTML, /blob:photo-1/);

  instance._emitRemove(0);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'attachment-remove');
  assert.equal(events[0].detail.index, 0);
  assert.equal(events[0].detail.item.mediaId, 'media-1');
});
