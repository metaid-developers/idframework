import test from 'node:test';
import assert from 'node:assert/strict';

function setupEnv() {
  const registry = new Map();
  const windowListeners = new Map();
  const intervalCallbacks = new Map();
  let nextIntervalId = 1;

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
    }

    setAttribute(name, value) {
      this._attrs.set(String(name), String(value));
    }

    getAttribute(name) {
      const key = String(name);
      return this._attrs.has(key) ? this._attrs.get(key) : null;
    }

    hasAttribute(name) {
      return this._attrs.has(String(name));
    }

    removeAttribute(name) {
      this._attrs.delete(String(name));
    }

    attachShadow() {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      return this.shadowRoot;
    }

    dispatchEvent() {
      return true;
    }
  }

  const walletStore = {
    isConnected: false,
    address: null,
    metaid: null,
    globalMetaId: null,
    globalMetaIdInfo: null,
    publicKey: null,
    network: null,
  };
  const appStore = {
    isLogin: false,
    userAddress: null,
  };
  const userStore = {
    user: { name: 'Old User', metaid: 'oldmetaid' },
    isLoading: false,
    showProfileEditModal: false,
  };
  const stores = {
    wallet: walletStore,
    app: appStore,
    user: userStore,
  };

  const storage = {};
  const localStorageMock = {
    getItem(key) {
      const k = String(key);
      return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
    },
    setItem(key, value) {
      storage[String(key)] = String(value);
    },
    removeItem(key) {
      delete storage[String(key)];
    },
  };

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
          return this._text;
        },
      };
    },
  };
  globalThis.CustomEvent = class {
    constructor(type, init) {
      this.type = type;
      this.detail = init && init.detail ? init.detail : null;
    }
  };
  globalThis.requestAnimationFrame = (cb) => {
    if (typeof cb === 'function') cb();
    return 0;
  };
  globalThis.setInterval = (cb) => {
    const id = nextIntervalId++;
    intervalCallbacks.set(id, cb);
    return id;
  };
  globalThis.clearInterval = (id) => {
    intervalCallbacks.delete(id);
  };

  globalThis.Alpine = {
    store(name) {
      return stores[String(name)] || null;
    },
  };

  globalThis.localStorage = localStorageMock;
  let locale = 'en';
  const i18nMap = {
    en: {
      'connectButton.editProfile': 'Edit Profile',
      'connectButton.logout': 'Log Out',
    },
    zh: {
      'connectButton.editProfile': '编辑资料',
      'connectButton.logout': '退出登录',
    },
  };
  globalThis.window = {
    Alpine: globalThis.Alpine,
    localStorage: localStorageMock,
    addEventListener(type, handler) {
      const key = String(type);
      if (!windowListeners.has(key)) windowListeners.set(key, new Set());
      windowListeners.get(key).add(handler);
    },
    removeEventListener(type, handler) {
      const key = String(type);
      if (!windowListeners.has(key)) return;
      windowListeners.get(key).delete(handler);
    },
    dispatchEvent(event) {
      const key = event && event.type ? String(event.type) : '';
      if (!key || !windowListeners.has(key)) return true;
      windowListeners.get(key).forEach((handler) => {
        try {
          handler(event);
        } catch (_) {}
      });
      return true;
    },
    IDFramework: {
      dispatch: async () => {},
      I18n: {
        t(key, _params, fallback) {
          const table = i18nMap[locale] || {};
          const path = String(key || '');
          if (Object.prototype.hasOwnProperty.call(table, path)) return table[path];
          return typeof fallback === 'string' ? fallback : path;
        },
      },
    },
  };

  return {
    registry,
    stores,
    storage,
    runIntervals() {
      Array.from(intervalCallbacks.values()).forEach((cb) => {
        if (typeof cb === 'function') cb();
      });
    },
    setLocale(nextLocale) {
      locale = String(nextLocale || 'en');
    },
    emitLocaleChanged(nextLocale, previousLocale) {
      window.dispatchEvent(new CustomEvent('id:i18n:changed', {
        detail: {
          locale: nextLocale,
          previousLocale: previousLocale || null,
        },
      }));
    },
  };
}

let cachedCtor = null;
async function loadComponent(registry) {
  if (!cachedCtor) {
    await import('../idframework/components/id-connect-button.js?case=session-sync');
    cachedCtor = registry.get('id-connect-button');
  }
  return cachedCtor;
}

test('id-connect-button restores connected state after refresh when wallet is still connected', async () => {
  const { registry, stores } = setupEnv();
  const IdConnectButton = await loadComponent(registry);
  assert.ok(IdConnectButton, 'id-connect-button should be registered');

  const walletAddress = 'mvc-address-001';

  globalThis.window.metaidwallet = {
    async getAddress() {
      return walletAddress;
    },
    async isConnected() {
      return { status: 'connected' };
    },
  };

  globalThis.window.IDFramework.dispatch = async (commandName) => {
    if (commandName === 'connectWallet') {
      stores.wallet.isConnected = true;
      stores.wallet.address = walletAddress;
      stores.wallet.globalMetaId = 'gmid-001';
      stores.app.isLogin = true;
      stores.app.userAddress = walletAddress;
    }
  };

  const instance = new IdConnectButton();
  instance.render = function () {};
  await instance.checkConnection();

  assert.equal(instance.getAttribute('connected'), 'true');
  assert.equal(instance.getAttribute('address'), walletAddress);
  assert.equal(stores.wallet.isConnected, true);
  assert.equal(stores.app.isLogin, true);
});

test('id-connect-button re-syncs to new wallet address when account switched', async () => {
  const { registry, stores } = setupEnv();
  const IdConnectButton = await loadComponent(registry);
  assert.ok(IdConnectButton, 'id-connect-button should be registered');

  stores.wallet.isConnected = true;
  stores.wallet.address = 'mvc-old-address';
  stores.wallet.globalMetaId = 'gmid-old';
  stores.app.isLogin = true;
  stores.app.userAddress = 'mvc-old-address';

  const switchedAddress = 'mvc-new-address';

  globalThis.window.metaidwallet = {
    async getAddress() {
      return switchedAddress;
    },
    async isConnected() {
      return { status: 'connected' };
    },
  };

  globalThis.window.IDFramework.dispatch = async (commandName) => {
    if (commandName === 'connectWallet') {
      stores.wallet.isConnected = true;
      stores.wallet.address = switchedAddress;
      stores.wallet.globalMetaId = 'gmid-new';
      stores.app.isLogin = true;
      stores.app.userAddress = switchedAddress;
    }
  };

  const instance = new IdConnectButton();
  instance.render = function () {};
  await instance.checkConnection();

  assert.equal(stores.wallet.address, switchedAddress);
  assert.equal(stores.app.userAddress, switchedAddress);
  assert.equal(instance.getAttribute('address'), switchedAddress);
});

test('id-connect-button clears local login state when wallet is no longer connected', async () => {
  const { registry, stores } = setupEnv();
  const IdConnectButton = await loadComponent(registry);
  assert.ok(IdConnectButton, 'id-connect-button should be registered');

  stores.wallet.isConnected = true;
  stores.wallet.address = 'mvc-old-address';
  stores.wallet.globalMetaId = 'gmid-old';
  stores.app.isLogin = true;
  stores.app.userAddress = 'mvc-old-address';

  globalThis.window.metaidwallet = {
    async getAddress() {
      return { status: 'not-connected' };
    },
    async isConnected() {
      return { status: 'not-connected' };
    },
  };

  const instance = new IdConnectButton();
  instance.render = function () {};
  instance.setAttribute('connected', 'true');
  instance.setAttribute('address', 'mvc-old-address');
  await instance.checkConnection();

  assert.equal(stores.wallet.isConnected, false);
  assert.equal(stores.wallet.address, null);
  assert.equal(stores.app.isLogin, false);
  assert.equal(instance.hasAttribute('connected'), false);
});

test('id-connect-button updates dropdown labels when locale changes', async () => {
  const { registry, setLocale, emitLocaleChanged } = setupEnv();
  const IdConnectButton = await loadComponent(registry);
  assert.ok(IdConnectButton, 'id-connect-button should be registered');

  const instance = new IdConnectButton();
  instance.waitForMetaidwallet = async () => false;
  instance._restoreSessionFromLocalStorage = () => false;
  instance.checkConnection = async () => {};
  instance._watchUserStore = () => {};
  instance._bindWalletEventListeners = () => {};
  instance._startWalletSyncPolling = () => {};

  instance.setAttribute('connected', 'true');
  instance.setAttribute('address', 'mvc-address-001');
  instance._dropdownOpen = true;

  await instance.connectedCallback();

  assert.match(instance.shadowRoot.innerHTML, /Edit Profile/);
  assert.match(instance.shadowRoot.innerHTML, /Log Out/);

  setLocale('zh');
  emitLocaleChanged('zh', 'en');

  assert.match(instance.shadowRoot.innerHTML, /编辑资料/);
  assert.match(instance.shadowRoot.innerHTML, /退出登录/);
});

test('id-connect-button watcher rerenders when loading state toggles without profile data changes', async () => {
  const { registry, stores, runIntervals } = setupEnv();
  const IdConnectButton = await loadComponent(registry);
  assert.ok(IdConnectButton, 'id-connect-button should be registered');

  stores.wallet.isConnected = true;
  stores.wallet.address = 'mvc-address-001';
  stores.wallet.globalMetaId = 'gmid-001';
  stores.user.user = { name: 'Alice', metaid: 'alice' };
  stores.user.isLoading = true;

  const instance = new IdConnectButton();
  instance.setAttribute('connected', 'true');
  instance.setAttribute('address', 'mvc-address-001');
  let renderCount = 0;
  instance.render = () => { renderCount += 1; };

  instance._watchUserStore();
  runIntervals();
  assert.equal(renderCount, 1, 'initial watcher tick should render once');

  stores.user.isLoading = false;
  runIntervals();
  assert.equal(renderCount, 2, 'loading state change should trigger rerender without click interaction');
});
