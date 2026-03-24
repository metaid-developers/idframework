import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv(chainFeeStore = null) {
  const registry = new Map();

  class MockHTMLElement {
    constructor() {
      this.shadowRoot = null;
    }

    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() { return true; }
    contains() { return false; }

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
    addEventListener() {},
    removeEventListener() {},
    createElement() {
      return {
        _text: '',
        set textContent(value) {
          this._text = value == null ? '' : String(value);
        },
        get innerHTML() {
          return this._text;
        },
      };
    },
  };

  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
  };

  globalThis.Alpine = {
    store(name) {
      if (String(name) === 'chainFee') return chainFeeStore;
      return null;
    },
  };

  return registry;
}

test('id-chain-fee-selector defaults to mvc economy fee and keeps mvc fallback when store fee type is missing', async () => {
  const chainFeeStore = {
    currentChain: 'mvc',
    btc: {},
    mvc: {},
    doge: {},
  };
  const registry = setupEnv(chainFeeStore);

  await import('../idframework/components/id-chain-fee-selector.js?case=defaults-combined');
  const IdChainFeeSelector = registry.get('id-chain-fee-selector');
  const instance = new IdChainFeeSelector();

  const draft = instance._createEmptyDraft();
  assert.equal(draft.currentChain, 'mvc');
  assert.equal(draft.mvc.selectedFeeType, 'economyFee');

  instance._syncDraftFromStore();
  assert.equal(instance._draft.currentChain, 'mvc');
  assert.equal(instance._draft.mvc.selectedFeeType, 'economyFee');
});
