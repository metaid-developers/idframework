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

function setupProfileHeaderEnv(stores) {
  const registry = new Map();

  class MockHTMLElement {
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

  globalThis.document = createDocumentStub();
  globalThis.window = {
    location: {
      pathname: '/demo-buzz/index.html',
      hash: '#/profile/target_metaid',
      protocol: 'https:',
    },
  };

  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  return registry;
}

function createStores() {
  return {
    app: {
      route: {
        path: '/profile/target_metaid',
        params: {
          metaid: 'target_metaid',
        },
      },
      profileMetaid: 'target_metaid',
    },
    wallet: {
      isConnected: true,
      address: '1addressA',
      metaid: '',
    },
    user: {
      user: {},
    },
    buzz: {
      profileHeader: {
        byMetaid: {
          target_metaid: {
            metaid: 'target_metaid',
            name: '',
            address: '',
            avatar: '',
            bio: '',
            chainName: '',
            followingTotal: 0,
            followerTotal: 0,
            isFollowing: false,
            followPinId: '',
            viewerMetaid: '',
            followOptimisticUntil: 0,
            isLoading: false,
            followLoading: false,
            hasLoaded: false,
            error: '',
            lastUpdatedAt: 0,
          },
        },
      },
    },
  };
}

test('id-profile-header signature changes when wallet address changes', async () => {
  const stores = createStores();
  const registry = setupProfileHeaderEnv(stores);
  await import('../idframework/components/id-profile-header.js');

  const IdProfileHeader = registry.get('id-profile-header');
  const instance = new IdProfileHeader();

  const before = instance._buildSignature();
  stores.wallet.address = '1addressB';
  const after = instance._buildSignature();

  assert.notEqual(
    before,
    after,
    'wallet address changes must trigger signature changes for re-render'
  );
});

test('id-profile-header signature changes when hasLoaded changes', async () => {
  const stores = createStores();
  const registry = setupProfileHeaderEnv(stores);
  await import('../idframework/components/id-profile-header.js?case=loaded-flag');

  const IdProfileHeader = registry.get('id-profile-header');
  const instance = new IdProfileHeader();

  const segment = stores.buzz.profileHeader.byMetaid.target_metaid;
  const before = instance._buildSignature();
  segment.hasLoaded = true;
  const after = instance._buildSignature();

  assert.notEqual(
    before,
    after,
    'hasLoaded changes must trigger signature changes for re-render'
  );
});

test('id-profile-header keeps optimistic follow state during reconcile window', async () => {
  const stores = createStores();
  const registry = setupProfileHeaderEnv(stores);
  await import('../idframework/components/id-profile-header.js?case=optimistic-follow');

  const IdProfileHeader = registry.get('id-profile-header');
  const instance = new IdProfileHeader();

  const segment = stores.buzz.profileHeader.byMetaid.target_metaid;
  segment.isFollowing = true;
  segment.followPinId = 'a'.repeat(64) + 'i0';
  segment.followOptimisticUntil = Date.now() + 30000;

  instance._applyProfileResult(segment, 'target_metaid', {
    metaid: 'target_metaid',
    name: 'Alice',
    address: '1target',
    followingTotal: 1,
    followerTotal: 2,
    isFollowing: false,
    followPinId: '',
  });

  assert.equal(segment.isFollowing, true);
  assert.equal(segment.followPinId, 'a'.repeat(64) + 'i0');
});

test('id-profile-header renders following/followers as panel trigger buttons', async () => {
  const stores = createStores();
  const registry = setupProfileHeaderEnv(stores);
  await import('../idframework/components/id-profile-header.js?case=user-list-trigger-buttons');

  const IdProfileHeader = registry.get('id-profile-header');
  const instance = new IdProfileHeader();

  const segment = stores.buzz.profileHeader.byMetaid.target_metaid;
  segment.name = 'Alice';
  segment.hasLoaded = true;
  segment.isLoading = false;

  instance.render();

  assert.match(instance.shadowRoot.innerHTML, /data-action="open-user-list"/);
  assert.match(instance.shadowRoot.innerHTML, /data-type="following"/);
  assert.match(instance.shadowRoot.innerHTML, /data-type="followers"/);
});
