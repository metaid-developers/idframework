import test from 'node:test';
import assert from 'node:assert/strict';

function createAlpineStore() {
  const stores = new Map();
  return {
    store(name, value) {
      if (arguments.length === 2) {
        stores.set(name, value);
        return value;
      }
      return stores.get(name);
    },
  };
}

test('IDFramework.dispatch forwards chat store to commands', async () => {
  const alpine = createAlpineStore();
  const chatStore = { messages: {} };

  globalThis.window = {
    Alpine: alpine,
    addEventListener() {},
  };

  alpine.store('wallet', { isConnected: false });
  alpine.store('app', { isLogin: false });
  alpine.store('user', { user: {} });
  alpine.store('chat', chatStore);

  await import('../idframework/idframework.js?case=dispatch-chat-store');

  let capturedStores = null;
  const originalExecute = window.IDFramework.IDController.execute;
  window.IDFramework.IDController.execute = async (_eventName, _payload, stores) => {
    capturedStores = stores;
    return null;
  };

  await window.IDFramework.dispatch('dummy', {});

  window.IDFramework.IDController.execute = originalExecute;

  assert.ok(capturedStores, 'stores should be passed');
  assert.equal(capturedStores.chat, chatStore);
});
