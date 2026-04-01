import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

test('IDFramework.dispatch forwards note and draft stores to commands', async () => {
  const alpine = createAlpineStore();
  const noteStore = { route: null };
  const draftStore = { items: [] };

  globalThis.window = {
    Alpine: alpine,
    addEventListener() {},
  };

  alpine.store('wallet', { isConnected: false });
  alpine.store('app', { isLogin: false });
  alpine.store('user', { user: {} });
  alpine.store('note', noteStore);
  alpine.store('draft', draftStore);

  const frameworkUrl = pathToFileURL(path.resolve('idframework/idframework.js'));
  await import(`${frameworkUrl.href}?case=dispatch-note-store`);

  window.IDFramework.initModels({ note: noteStore, draft: draftStore });

  let capturedStores = null;
  const originalExecute = window.IDFramework.IDController.execute;
  window.IDFramework.IDController.execute = async (_eventName, _payload, stores) => {
    capturedStores = stores;
    return null;
  };

  await window.IDFramework.dispatch('dummy', {});

  window.IDFramework.IDController.execute = originalExecute;

  assert.ok(capturedStores, 'stores should be passed');
  assert.equal(capturedStores.note, noteStore);
  assert.equal(capturedStores.draft, draftStore);
});

test('IDController.execute auto-resolves note and draft stores when stores are omitted', async () => {
  const alpine = createAlpineStore();
  const noteStore = { route: null };
  const draftStore = { items: [] };
  const existingFramework = globalThis.window && globalThis.window.IDFramework;

  globalThis.window = {
    Alpine: alpine,
    addEventListener() {},
    IDFramework: existingFramework,
  };

  if (!window.IDFramework) {
    const frameworkUrl = pathToFileURL(path.resolve('idframework/idframework.js'));
    await import(`${frameworkUrl.href}?case=execute-note-store`);
  }

  window.IDFramework.initModels({ note: noteStore, draft: draftStore });

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'idf-note-store-'));
  const commandPath = path.join(tmpDir, 'CaptureStoresCommand.mjs');
  await writeFile(
    commandPath,
    'export default class CaptureStoresCommand { async execute({ stores }) { return stores; } }\n',
    'utf8',
  );

  try {
    window.IDFramework.IDController.register(
      'captureNoteDraftStores',
      pathToFileURL(commandPath).href,
    );

    const capturedStores = await window.IDFramework.IDController.execute('captureNoteDraftStores', {});

    assert.equal(capturedStores.note, noteStore);
    assert.equal(capturedStores.draft, draftStore);
    assert.ok(capturedStores.wallet, 'wallet store should still be available');
    assert.ok(capturedStores.app, 'app store should still be available');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
