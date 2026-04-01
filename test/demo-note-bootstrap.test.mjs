import test from 'node:test';
import assert from 'node:assert/strict';

function createStoreRegistry() {
  const stores = {
    app: {},
    wallet: {},
  };

  return {
    stores,
    store(name, value) {
      if (arguments.length === 2) {
        stores[name] = value;
        return value;
      }
      return stores[name];
    },
  };
}

test('demo-note app bootstrap initializes stores, catalogs, command registry, and sync command wiring', async () => {
  const registry = createStoreRegistry();
  const registeredCommands = [];
  const loadedComponents = [];
  const dispatchCalls = [];
  const registeredCatalogs = [];

  globalThis.window = {
    __IDFRAMEWORK_DISABLE_AUTO_BOOTSTRAP: true,
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/' },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
    ServiceLocator: {},
    IDFrameworkConfig: {},
    Alpine: {
      store: registry.store,
    },
    IDFramework: {
      init(models) {
        Object.keys(models || {}).forEach((name) => {
          registry.store(name, JSON.parse(JSON.stringify(models[name])));
        });
      },
      I18n: {
        init() {},
        registerMessages(namespaceOrCatalogs, maybeCatalogs) {
          registeredCatalogs.push([namespaceOrCatalogs, maybeCatalogs]);
        },
      },
      IDController: {
        register(name, path) {
          registeredCommands.push([name, path]);
        },
      },
      async loadComponent(path) {
        loadedComponents.push(path);
      },
      async dispatch(eventName, payload) {
        dispatchCalls.push([eventName, payload]);
        return payload && payload.route ? payload.route : null;
      },
    },
  };
  globalThis.document = {
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  globalThis.Alpine = globalThis.window.Alpine;

  const module = await import('../demo-note/app.js');
  await module.bootstrapDemoNoteApp();

  assert.ok(registry.store('note'));
  assert.ok(registry.store('draft'));
  assert.ok(registry.store('user'));
  assert.equal(registry.store('note').route.view, 'list');
  assert.equal(Array.isArray(registry.store('draft').items), true);

  const commandMap = new Map(registeredCommands);
  assert.equal(commandMap.get('syncNoteRoute'), '@idf/commands/SyncNoteRouteCommand.js');
  assert.equal(commandMap.get('fetchNoteList'), '@idf/commands/FetchNoteListCommand.js');
  assert.equal(commandMap.get('createNote'), '@idf/commands/CreateNoteCommand.js');
  assert.equal(commandMap.get('saveDraft'), '@idf/commands/SaveDraftCommand.js');

  assert.ok(registeredCatalogs.length >= 1);
  assert.ok(loadedComponents.includes('@idf/components/id-note-shell.js'));
  assert.ok(dispatchCalls.some(([eventName]) => eventName === 'syncNoteRoute'));
});

test('demo-note loadRouteData redirects blocked encrypted edits back to detail route', async () => {
  const registry = createStoreRegistry();
  const replaceCalls = [];
  const dispatchCalls = [];

  globalThis.window = {
    __IDFRAMEWORK_DISABLE_AUTO_BOOTSTRAP: true,
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/note/note-pin-2/edit' },
    history: {
      pushState() {},
      replaceState(_state, _title, url) {
        replaceCalls.push(url);
        this.lastUrl = url;
        globalThis.window.location.hash = url.split('#')[1] ? '#' + url.split('#')[1] : '';
      },
    },
    addEventListener() {},
    removeEventListener() {},
    ServiceLocator: {},
    IDFrameworkConfig: {},
    Alpine: {
      store: registry.store,
    },
    IDFramework: {
      dispatch(eventName, payload) {
        dispatchCalls.push([eventName, payload]);
        if (eventName === 'prepareNoteEditor') {
          return Promise.resolve({ blocked: true, redirectPath: '/note/note-pin-2' });
        }
        if (eventName === 'syncNoteRoute') {
          return Promise.resolve({ path: '/note/note-pin-2', view: 'detail', params: { id: 'note-pin-2' }, query: {} });
        }
        if (eventName === 'fetchNoteDetail') {
          return Promise.resolve({ pin: { address: 'author-2' }, noteData: { encryption: '0' } });
        }
        return Promise.resolve(null);
      },
      I18n: {
        init() {},
        registerMessages() {},
      },
      IDController: {
        register() {},
      },
      loadComponent() {
        return Promise.resolve();
      },
      init(models) {
        Object.keys(models || {}).forEach((name) => {
          registry.store(name, JSON.parse(JSON.stringify(models[name])));
        });
      },
    },
  };
  globalThis.document = {
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  globalThis.Alpine = globalThis.window.Alpine;

  const module = await import('../demo-note/app.js?case=blocked-editor-redirect');
  registry.store('app', { route: { path: '/note/note-pin-2/edit', view: 'editor', params: { id: 'note-pin-2' }, query: {} } });
  registry.store('note', {
    route: { path: '/note/note-pin-2/edit', view: 'editor', params: { id: 'note-pin-2' }, query: {} },
    publicList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '' },
    myList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '' },
    detail: { pinId: '', pin: null, noteData: null, author: null, isLoading: false, error: '' },
    editor: { mode: 'edit', pinId: 'note-pin-2', form: {}, existingAttachments: [], pendingAttachments: [], currentDraftId: null, isLoading: false, isSaving: false, error: '' },
  });
  registry.store('wallet', {});
  registry.store('draft', { items: [], currentDraftId: null, isLoading: false, error: '' });
  registry.store('user', { user: {}, users: {}, isLoading: false, error: null, showProfileEditModal: false });

  await module.loadRouteData({ path: '/note/note-pin-2/edit', view: 'editor', params: { id: 'note-pin-2' }, query: {} });

  assert.deepEqual(replaceCalls, ['/demo-note/index.html#/note/note-pin-2']);
  assert.ok(dispatchCalls.some(([eventName]) => eventName === 'prepareNoteEditor'));
  assert.ok(dispatchCalls.some(([eventName]) => eventName === 'syncNoteRoute'));
  assert.ok(dispatchCalls.some(([eventName]) => eventName === 'fetchNoteDetail'));
});

test('demo-note loadRouteData resets public list pagination when re-entering home', async () => {
  const registry = createStoreRegistry();
  const dispatchCalls = [];

  globalThis.window = {
    __IDFRAMEWORK_DISABLE_AUTO_BOOTSTRAP: true,
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/' },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
    ServiceLocator: {},
    IDFrameworkConfig: {},
    Alpine: {
      store: registry.store,
    },
    IDFramework: {
      dispatch(eventName, payload) {
        dispatchCalls.push([eventName, payload]);
        return Promise.resolve(null);
      },
      I18n: {
        init() {},
        registerMessages() {},
      },
      IDController: {
        register() {},
      },
      loadComponent() {
        return Promise.resolve();
      },
      init(models) {
        Object.keys(models || {}).forEach((name) => {
          registry.store(name, JSON.parse(JSON.stringify(models[name])));
        });
      },
    },
  };
  globalThis.document = {
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  globalThis.Alpine = globalThis.window.Alpine;

  const module = await import('../demo-note/app.js?case=route-reset-public');
  registry.store('note', {
    route: { path: '/note/old-note', view: 'detail', params: { id: 'old-note' }, query: {} },
    publicList: {
      items: [{ pin: { id: 'stale' }, noteData: { title: 'Stale' } }],
      cursor: 'cursor-5',
      hasMore: true,
      isLoading: false,
      error: '',
      page: 5,
      pageSize: 20,
      currentCursor: 'cursor-4',
      cursorHistory: ['0', 'cursor-1', 'cursor-2', 'cursor-3', 'cursor-4'],
    },
    myList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '', page: 1, pageSize: 20, currentCursor: '0', cursorHistory: ['0'] },
    detail: { pinId: '', pin: null, noteData: null, author: null, isLoading: false, error: '' },
    editor: { mode: 'create', pinId: '', form: {}, existingAttachments: [], pendingAttachments: [], currentDraftId: null, isLoading: false, isSaving: false, error: '' },
  });

  await module.loadRouteData({ path: '/', view: 'list', params: {}, query: {} });

  assert.deepEqual(dispatchCalls, [[
    'fetchNoteList',
    {
      cursor: '0',
      size: 20,
      replace: true,
      page: 1,
      pageSize: 20,
      currentCursor: '0',
      cursorHistory: ['0'],
    },
  ]]);
});

test('demo-note loadRouteData resets my-note pagination with resolved address', async () => {
  const registry = createStoreRegistry();
  const dispatchCalls = [];

  globalThis.window = {
    __IDFRAMEWORK_DISABLE_AUTO_BOOTSTRAP: true,
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/mynote' },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
    ServiceLocator: {},
    IDFrameworkConfig: {},
    Alpine: {
      store: registry.store,
    },
    IDFramework: {
      dispatch(eventName, payload) {
        dispatchCalls.push([eventName, payload]);
        return Promise.resolve(null);
      },
      I18n: {
        init() {},
        registerMessages() {},
      },
      IDController: {
        register() {},
      },
      loadComponent() {
        return Promise.resolve();
      },
      init(models) {
        Object.keys(models || {}).forEach((name) => {
          registry.store(name, JSON.parse(JSON.stringify(models[name])));
        });
      },
    },
  };
  globalThis.document = {
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  globalThis.Alpine = globalThis.window.Alpine;

  const module = await import('../demo-note/app.js?case=route-reset-my');
  registry.store('wallet', { address: '1owner' });
  registry.store('user', { user: {}, users: {}, isLoading: false, error: null, showProfileEditModal: false });
  registry.store('note', {
    route: { path: '/note/old-note', view: 'detail', params: { id: 'old-note' }, query: {} },
    publicList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '', page: 1, pageSize: 20, currentCursor: '0', cursorHistory: ['0'] },
    myList: {
      items: [{ pin: { id: 'stale' }, noteData: { title: 'Old mine' } }],
      cursor: 'cursor-5',
      hasMore: true,
      isLoading: false,
      error: '',
      page: 5,
      pageSize: 20,
      currentCursor: 'cursor-4',
      cursorHistory: ['0', 'cursor-1', 'cursor-2', 'cursor-3', 'cursor-4'],
    },
    detail: { pinId: '', pin: null, noteData: null, author: null, isLoading: false, error: '' },
    editor: { mode: 'create', pinId: '', form: {}, existingAttachments: [], pendingAttachments: [], currentDraftId: null, isLoading: false, isSaving: false, error: '' },
  });

  await module.loadRouteData({ path: '/mynote', view: 'mynote', params: {}, query: {} });

  assert.deepEqual(dispatchCalls, [[
    'fetchMyNoteList',
    {
      address: '1owner',
      cursor: '0',
      size: 20,
      replace: true,
      page: 1,
      pageSize: 20,
      currentCursor: '0',
      cursorHistory: ['0'],
    },
  ]]);
});

test('demo-note loadRouteData skips my-note reset fetch when no address is available', async () => {
  const registry = createStoreRegistry();
  const dispatchCalls = [];

  globalThis.window = {
    __IDFRAMEWORK_DISABLE_AUTO_BOOTSTRAP: true,
    location: { pathname: '/demo-note/index.html', search: '', hash: '#/mynote' },
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
    ServiceLocator: {},
    IDFrameworkConfig: {},
    Alpine: {
      store: registry.store,
    },
    IDFramework: {
      dispatch(eventName, payload) {
        dispatchCalls.push([eventName, payload]);
        return Promise.resolve(null);
      },
      I18n: {
        init() {},
        registerMessages() {},
      },
      IDController: {
        register() {},
      },
      loadComponent() {
        return Promise.resolve();
      },
      init(models) {
        Object.keys(models || {}).forEach((name) => {
          registry.store(name, JSON.parse(JSON.stringify(models[name])));
        });
      },
    },
  };
  globalThis.document = {
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
  };
  globalThis.Alpine = globalThis.window.Alpine;

  const module = await import('../demo-note/app.js?case=route-reset-my-no-address');
  registry.store('wallet', { address: '' });
  registry.store('user', { user: {}, users: {}, isLoading: false, error: null, showProfileEditModal: false });
  registry.store('note', {
    route: { path: '/mynote', view: 'mynote', params: {}, query: {} },
    publicList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '', page: 1, pageSize: 20, currentCursor: '0', cursorHistory: ['0'] },
    myList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '', page: 1, pageSize: 20, currentCursor: '0', cursorHistory: ['0'] },
    detail: { pinId: '', pin: null, noteData: null, author: null, isLoading: false, error: '' },
    editor: { mode: 'create', pinId: '', form: {}, existingAttachments: [], pendingAttachments: [], currentDraftId: null, isLoading: false, isSaving: false, error: '' },
  });

  const result = await module.loadRouteData({ path: '/mynote', view: 'mynote', params: {}, query: {} });

  assert.equal(result, null);
  assert.deepEqual(dispatchCalls, []);
});
