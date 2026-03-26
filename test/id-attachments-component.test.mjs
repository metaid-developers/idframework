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

  class MockHTMLElement {
    constructor() {
      this.shadowRoot = null;
      this.isConnected = false;
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
  globalThis.document = createDocumentStub();
  globalThis.window = {};

  return registry;
}

test('id-attachments renders videos with proportional height instead of image crop styles', async () => {
  const registry = setupEnv();
  await import('../idframework/components/id-attachments.js?case=video-proportional-style');
  const IdAttachments = registry.get('id-attachments');
  const instance = new IdAttachments();

  instance._attachments = ['video-attachment'];
  instance._items = [
    {
      kind: 'video',
      fileName: 'clip.mp4',
      contentUrl: 'https://example.com/clip.mp4',
    },
  ];
  instance._activatedByViewport = true;
  instance.render();

  const html = instance.shadowRoot.innerHTML;
  const videoStyle = html.match(/\.media-video\s*\{([^}]*)\}/);
  const imageStyle = html.match(/\.media-image\s*\{([^}]*)\}/);

  assert.match(html, /<video class="media-video"/);
  assert.ok(videoStyle, 'video styles should have their own rule block');
  assert.ok(imageStyle, 'image styles should keep their own rule block');
  assert.match(videoStyle[1], /width:\s*100%/);
  assert.match(videoStyle[1], /height:\s*auto/);
  assert.doesNotMatch(videoStyle[1], /aspect-ratio\s*:/);
  assert.doesNotMatch(videoStyle[1], /object-fit\s*:\s*cover/);
  assert.match(imageStyle[1], /aspect-ratio\s*:\s*4\s*\/\s*3/);
  assert.match(imageStyle[1], /object-fit\s*:\s*cover/);
});
