import noteZh from './i18n/note.zh.js';
import noteEn from './i18n/note.en.js';
import { buildNoteRouteUrl } from '../idframework/utils/note-route.js';

export const NOTE_MODEL = {
  route: { path: '/', view: 'list', params: {}, query: {} },
  publicList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '' },
  myList: { items: [], cursor: 0, hasMore: true, isLoading: false, error: '' },
  detail: { pinId: '', pin: null, noteData: null, author: null, isLoading: false, error: '' },
  editor: {
    mode: 'create',
    pinId: '',
    form: {
      title: '',
      subtitle: '',
      content: '',
      contentType: 'text/markdown',
      encryption: '0',
      coverImg: '',
      createTime: '',
      tags: [],
      attachments: [],
    },
    existingAttachments: [],
    pendingAttachments: [],
    currentDraftId: null,
    isLoading: false,
    isSaving: false,
    error: '',
  },
};

export const DRAFT_MODEL = {
  items: [],
  currentDraftId: null,
  isLoading: false,
  error: '',
};

export const USER_MODEL = {
  user: {},
  users: {},
  isLoading: false,
  error: null,
  showProfileEditModal: false,
};

export const NOTE_COMPONENTS = [
  '@idf/components/id-connect-button.js',
  '@idf/components/id-userinfo-float-panel.js',
  '@idf/components/id-note-shell.js',
  '@idf/components/id-note-detail.js',
  '@idf/components/id-note-editor.js',
  '@idf/components/id-note-draft-list.js',
];

export const NOTE_COMMANDS = [
  ['fetchUser', '@idf/commands/FetchUserCommand.js'],
  ['fetchUserInfo', '@idf/commands/FetchUserInfoCommand.js'],
  ['syncNoteRoute', '@idf/commands/SyncNoteRouteCommand.js'],
  ['fetchNoteList', '@idf/commands/FetchNoteListCommand.js'],
  ['fetchMyNoteList', '@idf/commands/FetchMyNoteListCommand.js'],
  ['fetchNoteDetail', '@idf/commands/FetchNoteDetailCommand.js'],
  ['resolveNoteAuthor', '@idf/commands/ResolveNoteAuthorCommand.js'],
  ['decryptNoteContent', '@idf/commands/DecryptNoteContentCommand.js'],
  ['prepareNoteEditor', '@idf/commands/PrepareNoteEditorCommand.js'],
  ['uploadNoteAttachment', '@idf/commands/UploadNoteAttachmentCommand.js'],
  ['createNote', '@idf/commands/CreateNoteCommand.js'],
  ['updateNote', '@idf/commands/UpdateNoteCommand.js'],
  ['loadDrafts', '@idf/commands/LoadDraftsCommand.js'],
  ['loadDraftById', '@idf/commands/LoadDraftByIdCommand.js'],
  ['saveDraft', '@idf/commands/SaveDraftCommand.js'],
  ['deleteDraft', '@idf/commands/DeleteDraftCommand.js'],
];

function getWindow() {
  return typeof window !== 'undefined' ? window : null;
}

function getDocument() {
  return typeof document !== 'undefined' ? document : null;
}

function getFramework() {
  var root = getWindow();
  return root && root.IDFramework ? root.IDFramework : null;
}

function getAlpine() {
  var root = getWindow();
  return root && root.Alpine ? root.Alpine : (typeof Alpine !== 'undefined' ? Alpine : null);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStore(name) {
  var alpine = getAlpine();
  if (!alpine || typeof alpine.store !== 'function') return null;
  return alpine.store(name) || null;
}

function ensureWindowConfig() {
  var root = getWindow();
  if (!root) return;
  root.ServiceLocator = {
    ...(root.ServiceLocator || {}),
    metaid_man: 'https://manapi.metaid.io',
    metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
    man_api: 'https://man.metaid.io/api',
  };
  root.IDFrameworkConfig = {
    ...(root.IDFrameworkConfig || {}),
    noteRouteMode: 'hash',
    routeComponentBasePath: '@idf/components/',
  };
}

function ensureAppStoreShape() {
  var app = getStore('app');
  if (!app) return;
  if (!app.route || typeof app.route !== 'object') {
    app.route = { path: '/', view: 'list', params: {}, query: {} };
  }
}

export function ensureNoteStoreShape() {
  var note = getStore('note');
  if (!note) return;

  if (!note.route || typeof note.route !== 'object') note.route = clone(NOTE_MODEL.route);
  if (!note.publicList || typeof note.publicList !== 'object') note.publicList = clone(NOTE_MODEL.publicList);
  if (!note.myList || typeof note.myList !== 'object') note.myList = clone(NOTE_MODEL.myList);
  if (!note.detail || typeof note.detail !== 'object') note.detail = clone(NOTE_MODEL.detail);
  if (!note.editor || typeof note.editor !== 'object') note.editor = clone(NOTE_MODEL.editor);
}

function ensureDraftStoreShape() {
  var draft = getStore('draft');
  if (!draft) return;
  if (!Array.isArray(draft.items)) draft.items = [];
  if (!('currentDraftId' in draft)) draft.currentDraftId = null;
  if (!('isLoading' in draft)) draft.isLoading = false;
  if (!('error' in draft)) draft.error = '';
}

function ensureUserStoreShape() {
  var user = getStore('user');
  if (!user) return;
  if (!user.user || typeof user.user !== 'object') user.user = {};
  if (!user.users || typeof user.users !== 'object') user.users = {};
  if (!('isLoading' in user)) user.isLoading = false;
  if (!('error' in user)) user.error = null;
  if (!('showProfileEditModal' in user)) user.showProfileEditModal = false;
}

function getI18n() {
  var framework = getFramework();
  return framework ? framework.I18n : null;
}

export function registerNoteCatalogs() {
  var i18n = getI18n();
  if (!i18n || typeof i18n.registerMessages !== 'function') return;
  i18n.registerMessages('note', {
    zh: noteZh,
    en: noteEn,
  });
}

function applyPageI18n() {
  var doc = getDocument();
  var i18n = getI18n();
  if (!doc || !i18n || typeof doc.querySelectorAll !== 'function') return;
  var elements = doc.querySelectorAll('[data-i18n]');
  for (var i = 0; i < elements.length; i += 1) {
    var node = elements[i];
    if (!node || !node.getAttribute) continue;
    var key = node.getAttribute('data-i18n');
    if (!key) continue;
    var fallback = node.getAttribute('data-i18n-fallback') || node.textContent || '';
    node.textContent = i18n.t(key, {}, fallback);
  }
  if (doc && noteZh.page && typeof doc.title === 'string') {
    doc.title = i18n.t('note.page.documentTitle', {}, 'IDFramework - On-chain Notes Demo');
  }
}

function bindLocaleSwitcher() {
  var doc = getDocument();
  var i18n = getI18n();
  if (!doc || !i18n || typeof doc.querySelectorAll !== 'function') return;
  var buttons = doc.querySelectorAll('[data-action="set-locale"]');
  for (var i = 0; i < buttons.length; i += 1) {
    var button = buttons[i];
    if (!button || typeof button.addEventListener !== 'function') continue;
    button.addEventListener('click', function handleLocaleClick(event) {
      var target = event && event.currentTarget ? event.currentTarget : button;
      var locale = target && target.getAttribute ? target.getAttribute('data-locale-value') : '';
      if (!locale) return;
      i18n.setLocale(locale);
      applyPageI18n();
    });
  }
}

function currentAddress() {
  var wallet = getStore('wallet') || {};
  var user = getStore('user') && getStore('user').user ? getStore('user').user : {};
  return String(wallet.address || user.address || '').trim();
}

function replaceRoutePath(path) {
  var root = getWindow();
  if (!root || !root.location || !root.history || typeof root.history.replaceState !== 'function') return false;
  var nextUrl = buildNoteRouteUrl(root.location, path, root);
  root.history.replaceState({}, '', nextUrl);
  return true;
}

export async function syncRouteToStore() {
  var framework = getFramework();
  if (!framework || typeof framework.dispatch !== 'function') return null;
  var route = await framework.dispatch('syncNoteRoute', {
    locationLike: getWindow() ? getWindow().location : null,
  });
  if (route) {
    var app = getStore('app');
    var note = getStore('note');
    if (app) app.route = route;
    if (note) note.route = route;
  }
  return route || (getStore('note') && getStore('note').route) || null;
}

export async function loadRouteData(route) {
  var framework = getFramework();
  if (!framework || typeof framework.dispatch !== 'function' || !route) return null;

  if (route.view === 'list') {
    return await framework.dispatch('fetchNoteList', { cursor: 0, size: 20 });
  }

  if (route.view === 'mynote') {
    var address = currentAddress();
    if (!address) return null;
    return await framework.dispatch('fetchMyNoteList', { address: address, cursor: 0, size: 20 });
  }

  if (route.view === 'draft') {
    return await framework.dispatch('loadDrafts', {});
  }

  if (route.view === 'detail' && route.params && route.params.id) {
    var detail = await framework.dispatch('fetchNoteDetail', { numberOrId: route.params.id });
    if (detail && detail.pin && detail.pin.address) {
      await framework.dispatch('resolveNoteAuthor', { address: detail.pin.address });
    }
    if (detail && detail.noteData && String(detail.noteData.encryption || '0') !== '0') {
      await framework.dispatch('decryptNoteContent', {
        noteData: detail.noteData,
        pin: detail.pin,
      });
    }
    return detail;
  }

  if (route.view === 'editor') {
    var prepared = await framework.dispatch('prepareNoteEditor', { route: route });
    if (prepared && prepared.blocked && prepared.redirectPath && replaceRoutePath(prepared.redirectPath)) {
      var redirectedRoute = await syncRouteToStore();
      if (redirectedRoute && redirectedRoute.path !== route.path) {
        return await loadRouteData(redirectedRoute);
      }
    }
    return prepared;
  }

  return null;
}

async function loadComponents() {
  var framework = getFramework();
  if (!framework || typeof framework.loadComponent !== 'function') return;
  for (var i = 0; i < NOTE_COMPONENTS.length; i += 1) {
    await framework.loadComponent(NOTE_COMPONENTS[i]);
  }
}

function registerCommands() {
  var framework = getFramework();
  if (!framework || !framework.IDController || typeof framework.IDController.register !== 'function') return;
  NOTE_COMMANDS.forEach(function eachCommand(entry) {
    framework.IDController.register(entry[0], entry[1]);
  });
}

async function handleRouteChange() {
  try {
    var route = await syncRouteToStore();
    await loadRouteData(route);
  } catch (error) {
    console.error('demo-note route load failed:', error);
  }
}

function bindRouteEvents() {
  var root = getWindow();
  var doc = getDocument();
  if (!root || root.__demoNoteEventsBound) return;
  root.__demoNoteEventsBound = true;

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('popstate', function () {
      handleRouteChange().catch(function ignore() {});
    });
    root.addEventListener('hashchange', function () {
      handleRouteChange().catch(function ignore() {});
    });
    root.addEventListener('id:note:navigate', function () {
      handleRouteChange().catch(function ignore() {});
    });
    root.addEventListener('id:i18n:changed', function () {
      applyPageI18n();
    });
  }

  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener('draft-open', function () {
      handleRouteChange().catch(function ignore() {});
    });
    doc.addEventListener('draft-delete', function () {
      handleRouteChange().catch(function ignore() {});
    });
  }
}

function waitForAlpine() {
  var root = getWindow();
  return new Promise(function (resolve) {
    if (root && root.Alpine && typeof root.Alpine.store === 'function') {
      resolve();
      return;
    }

    var timer = setInterval(function () {
      if (root && root.Alpine && typeof root.Alpine.store === 'function') {
        clearInterval(timer);
        resolve();
      }
    }, 50);
    if (timer && typeof timer.unref === 'function') timer.unref();

    setTimeout(function () {
      clearInterval(timer);
      resolve();
    }, 12000);
  });
}

export async function bootstrapDemoNoteApp() {
  var root = getWindow();
  ensureWindowConfig();
  await waitForAlpine();

  var framework = getFramework();
  if (!framework) {
    console.error('IDFramework is not loaded. Please include idframework.js before app.js');
    return null;
  }

  framework.init({
    note: clone(NOTE_MODEL),
    draft: clone(DRAFT_MODEL),
    user: clone(USER_MODEL),
  });
  ensureAppStoreShape();
  ensureNoteStoreShape();
  ensureDraftStoreShape();
  ensureUserStoreShape();
  registerNoteCatalogs();
  applyPageI18n();
  bindLocaleSwitcher();
  registerCommands();
  await loadComponents();
  bindRouteEvents();
  await handleRouteChange();
  if (root) root.__demoNoteBootstrapped = true;
  return {
    note: getStore('note'),
    draft: getStore('draft'),
    user: getStore('user'),
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !window.__IDFRAMEWORK_DISABLE_AUTO_BOOTSTRAP) {
  bootstrapDemoNoteApp().catch(function (error) {
    console.error('Failed to bootstrap demo-note:', error);
  });
}
