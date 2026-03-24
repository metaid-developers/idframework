import test from 'node:test';
import assert from 'node:assert/strict';

import PostBuzzCommand from '../idframework/commands/PostBuzzCommand.js';

test('PostBuzzCommand auto-injects metaid.js when MetaIDJs global is missing', async () => {
  const command = new PostBuzzCommand();
  const fakeLib = { mvc: {} };
  const appendedScripts = [];

  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalSetTimeout = globalThis.setTimeout;

  globalThis.setTimeout = (fn) => {
    if (typeof fn === 'function') fn();
    return 0;
  };

  globalThis.window = {};
  globalThis.document = {
    head: {
      appendChild(node) {
        appendedScripts.push(node);
        globalThis.window.MetaIDJs = fakeLib;
        if (typeof node.onload === 'function') node.onload();
      },
    },
    querySelector() {
      return null;
    },
    createElement(tag) {
      assert.equal(tag, 'script');
      const attrs = new Map();
      return {
        async: false,
        src: '',
        onload: null,
        onerror: null,
        setAttribute(name, value) {
          attrs.set(String(name), String(value));
        },
        getAttribute(name) {
          const key = String(name);
          return attrs.has(key) ? attrs.get(key) : null;
        },
      };
    },
  };

  try {
    const lib = await command._loadMetaIdJS();
    assert.equal(lib, fakeLib);
    assert.equal(appendedScripts.length, 1);
    assert.match(String(appendedScripts[0].src || ''), /vendors\/metaid\.js/i);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    globalThis.setTimeout = originalSetTimeout;
  }
});
