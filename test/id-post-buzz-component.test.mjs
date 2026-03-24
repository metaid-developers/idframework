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
    addEventListener: () => {},
    removeEventListener: () => {},
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
    IDUtils: null,
    IDFramework: null,
    location: { protocol: 'https:' },
  };

  return registry;
}

let cachedCtor = null;
async function loadIdPostBuzz(registry, suffix) {
  if (!cachedCtor) {
    await import('../idframework/components/id-post-buzz.js' + (suffix || ''));
    cachedCtor = registry.get('id-post-buzz');
  }
  return cachedCtor;
}

test('id-post-buzz limits local images to 9', async () => {
  const registry = setupEnv();
  const IdPostBuzz = await loadIdPostBuzz(registry, '?case=images-limit');
  assert.ok(IdPostBuzz, 'id-post-buzz should be registered');

  const instance = new IdPostBuzz();
  instance._showMessage = function () {};

  const files = Array.from({ length: 11 }).map((_, index) => (
    new File(['x'], 'img-' + index + '.png', { type: 'image/png' })
  ));

  await instance._appendPickedImages(files);
  assert.equal(instance._files.length, 9);
  assert.equal(instance._imageItems.length, 9);
});

test('id-post-buzz inserts emoji at current caret', async () => {
  const registry = setupEnv();
  const IdPostBuzz = await loadIdPostBuzz(registry, '?case=emoji-caret');
  assert.ok(IdPostBuzz, 'id-post-buzz should be registered');
  const instance = new IdPostBuzz();

  const textarea = {
    value: 'hello',
    selectionStart: 5,
    selectionEnd: 5,
    focus: () => {},
  };

  instance._content = 'hello';
  instance._insertEmojiAtCursor('😊', textarea);
  assert.equal(instance._content, 'hello😊');
  assert.equal(textarea.selectionStart, 7);
  assert.equal(textarea.selectionEnd, 7);
});

test('id-post-buzz enables post button for plain text input without full rerender', async () => {
  const registry = setupEnv();
  const IdPostBuzz = await loadIdPostBuzz(registry, '?case=plain-text-post-enable');
  assert.ok(IdPostBuzz, 'id-post-buzz should be registered');
  const instance = new IdPostBuzz();

  const postBtn = { disabled: true };
  const charsCounter = { textContent: '' };
  instance.shadowRoot = {
    querySelector(selector) {
      if (selector === '[data-action="post"]') return postBtn;
      if (selector === '[data-role="chars-counter"]') return charsCounter;
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  globalThis.window.IDFramework = {
    I18n: {
      t(_key, params, fallback) {
        return String(fallback || '').replace('{count}', String((params && params.count) || '0'));
      },
    },
  };

  instance._content = 'hello';
  instance._files = [];
  instance._quotePin = '';
  instance._isPosting = false;

  instance._updateComposerLiveState();

  assert.equal(postBtn.disabled, false);
  assert.equal(charsCounter.textContent, '5 chars');
});
