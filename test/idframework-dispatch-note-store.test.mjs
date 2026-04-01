import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import SyncNoteRouteCommand from '../idframework/commands/SyncNoteRouteCommand.js';

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

async function setupFrameworkWindow(alpine) {
  const existingFramework = globalThis.window && globalThis.window.IDFramework;

  globalThis.window = {
    Alpine: alpine,
    addEventListener() {},
    IDFramework: existingFramework,
    location: {
      pathname: '/index.html',
      search: '',
      hash: '',
    },
  };

  if (!window.IDFramework) {
    const frameworkUrl = pathToFileURL(path.resolve('idframework/idframework.js'));
    await import(`${frameworkUrl.href}?case=dispatch-note-store`);
  }

  window.IDFramework._customStoreNames = new Set();
  return window.IDFramework;
}

test('IDFramework.dispatch forwards note and draft stores to commands', async () => {
  const alpine = createAlpineStore();
  const noteStore = { route: null };
  const draftStore = { items: [] };
  const framework = await setupFrameworkWindow(alpine);

  alpine.store('wallet', { isConnected: false });
  alpine.store('app', { isLogin: false });
  alpine.store('user', { user: {} });
  alpine.store('note', noteStore);
  alpine.store('draft', draftStore);

  framework.initModels({ note: noteStore, draft: draftStore });

  let capturedStores = null;
  const originalExecute = framework.IDController.execute;
  framework.IDController.execute = async (_eventName, _payload, stores) => {
    capturedStores = stores;
    return null;
  };

  await framework.dispatch('dummy', {});

  framework.IDController.execute = originalExecute;

  assert.ok(capturedStores, 'stores should be passed');
  assert.equal(capturedStores.note, noteStore);
  assert.equal(capturedStores.draft, draftStore);
});

test('IDFramework.dispatch forwards arbitrary custom stores registered via initModels', async () => {
  const alpine = createAlpineStore();
  const sandboxStore = { value: 1 };
  const framework = await setupFrameworkWindow(alpine);

  alpine.store('wallet', { isConnected: false });
  alpine.store('app', { isLogin: false });
  alpine.store('user', { user: {} });
  alpine.store('sandbox', sandboxStore);

  framework.initModels({ sandbox: sandboxStore });

  let capturedStores = null;
  const originalExecute = framework.IDController.execute;
  framework.IDController.execute = async (_eventName, _payload, stores) => {
    capturedStores = stores;
    return null;
  };

  await framework.dispatch('dummy', {});

  framework.IDController.execute = originalExecute;

  assert.ok(capturedStores, 'stores should be passed');
  assert.equal(capturedStores.sandbox, sandboxStore);
});

test('IDFramework.dispatch does not forward note and draft unless registered via initModels', async () => {
  const alpine = createAlpineStore();
  const framework = await setupFrameworkWindow(alpine);

  alpine.store('wallet', { isConnected: false });
  alpine.store('app', { isLogin: false });
  alpine.store('user', { user: {} });
  alpine.store('note', { route: null });
  alpine.store('draft', { items: [] });

  let capturedStores = null;
  const originalExecute = framework.IDController.execute;
  framework.IDController.execute = async (_eventName, _payload, stores) => {
    capturedStores = stores;
    return null;
  };

  await framework.dispatch('dummy', {});

  framework.IDController.execute = originalExecute;

  assert.ok(capturedStores, 'stores should be passed');
  assert.equal(capturedStores.note, undefined);
  assert.equal(capturedStores.draft, undefined);
});

test('IDController.execute auto-resolves note and draft stores when stores are omitted', async () => {
  const alpine = createAlpineStore();
  const noteStore = { route: null };
  const draftStore = { items: [] };
  const framework = await setupFrameworkWindow(alpine);

  framework.initModels({ note: noteStore, draft: draftStore });

  const tmpDir = await mkdtemp(path.join(tmpdir(), 'idf-note-store-'));
  const commandPath = path.join(tmpDir, 'CaptureStoresCommand.mjs');
  await writeFile(
    commandPath,
    'export default class CaptureStoresCommand { async execute({ stores }) { return stores; } }\n',
    'utf8',
  );

  try {
    framework.IDController.register(
      'captureNoteDraftStores',
      pathToFileURL(commandPath).href,
    );

    const capturedStores = await framework.IDController.execute('captureNoteDraftStores', {});

    assert.equal(capturedStores.note, noteStore);
    assert.equal(capturedStores.draft, draftStore);
    assert.ok(capturedStores.wallet, 'wallet store should still be available');
    assert.ok(capturedStores.app, 'app store should still be available');
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test('SyncNoteRouteCommand updates app.route and note.route', async () => {
  const command = new SyncNoteRouteCommand();
  const stores = {
    app: { route: null },
    note: { route: null },
  };

  const route = await command.execute({
    payload: {
      locationLike: { hash: '#/note/abc/edit?draftId=9' },
    },
    stores,
  });

  assert.equal(route.view, 'editor');
  assert.equal(route.params.id, 'abc');
  assert.equal(route.query.draftId, '9');
  assert.equal(stores.app.route, route);
  assert.equal(stores.note.route, route);
});
