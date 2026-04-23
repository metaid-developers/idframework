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

test('id-note-cover-picker renders preview state and emits clear event', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-note-cover-picker.js?case=cover-picker-preview');
  const Ctor = registry.get('id-note-cover-picker');
  assert.ok(Ctor, 'id-note-cover-picker should be registered');

  const instance = new Ctor();
  const events = [];
  instance.dispatchEvent = (event) => {
    events.push(event);
    return true;
  };

  instance.setAttribute('value', 'data:image/png;base64,Zm9v');
  instance.connectedCallback();

  assert.match(instance.shadowRoot.innerHTML, /img/);
  assert.match(instance.shadowRoot.innerHTML, /Remove cover/);

  instance._emitChange('');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'cover-change');
  assert.equal(events[0].detail.value, '');
});
