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

function setupEnv(stores) {
  const registry = new Map();
  const intervals = [];
  const listeners = new Map();

  class MockHTMLElement {
    constructor() {
      this._attrs = new Map();
      this.shadowRoot = null;
    }

    setAttribute(name, value) {
      const key = String(name);
      const oldValue = this._attrs.has(key) ? this._attrs.get(key) : null;
      const nextValue = String(value);
      this._attrs.set(key, nextValue);
      if (typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(key, oldValue, nextValue);
      }
    }

    getAttribute(name) {
      const key = String(name);
      return this._attrs.has(key) ? this._attrs.get(key) : null;
    }

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
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
      this.bubbles = !!init.bubbles;
      this.composed = !!init.composed;
    }
  };
  globalThis.customElements = {
    define(name, ctor) {
      registry.set(name, ctor);
    },
    get(name) {
      return registry.get(name);
    },
  };
  globalThis.document = createDocumentStub();
  globalThis.setInterval = (fn, delay) => {
    const token = {
      fn,
      delay,
      unref() {},
    };
    intervals.push(token);
    return token;
  };
  globalThis.clearInterval = () => {};
  globalThis.window = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    IDFramework: {
      I18n: {
        t(_key, _params, fallback) {
          return fallback || '';
        },
      },
      async dispatch() {
        throw new Error('dispatch should be stubbed in test');
      },
    },
  };
  globalThis.Alpine = {
    store(name) {
      return stores[name] || null;
    },
  };

  return { registry, intervals, listeners };
}

function createStores() {
  return {
    note: {
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
    },
    draft: {
      currentDraftId: null,
    },
  };
}

function createInputStub(field, type = 'text') {
  const listeners = new Map();
  return {
    value: '',
    checked: false,
    type,
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    getAttribute(name) {
      if (name === 'data-field') return field;
      return null;
    },
  };
}

function createEditorShadowHarness() {
  const titleInput = createInputStub('title');
  const subtitleInput = createInputStub('subtitle');
  const tagsInput = createInputStub('tags');
  const privateInput = createInputStub('private', 'checkbox');
  const markdownEditor = {
    value: '',
    placeholder: '',
    addEventListener() {},
  };
  const coverPicker = {
    _attrs: new Map(),
    addEventListener() {},
    setAttribute(name, value) {
      this._attrs.set(String(name), String(value));
    },
    getAttribute(name) {
      return this._attrs.has(String(name)) ? this._attrs.get(String(name)) : null;
    },
  };
  const attachmentPicker = {
    items: [],
    addEventListener() {},
  };
  const status = {
    textContent: '',
    className: '',
  };
  const publishButton = {
    textContent: '',
    addEventListener() {},
  };

  return {
    innerHTML: '',
    querySelector(selector) {
      if (selector === 'id-note-markdown-editor') return markdownEditor;
      if (selector === 'id-note-cover-picker') return coverPicker;
      if (selector === 'id-note-attachment-picker') return attachmentPicker;
      if (selector === '[data-role="status"]') return status;
      if (selector === '[data-role="publish"]') return publishButton;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[data-field]') {
        return [titleInput, subtitleInput, tagsInput, privateInput];
      }
      return [];
    },
    refs: {
      titleInput,
      subtitleInput,
      tagsInput,
      privateInput,
      markdownEditor,
      coverPicker,
      attachmentPicker,
      status,
      publishButton,
    },
  };
}

test('id-note-editor schedules SaveDraftCommand every 5000ms when dirty and protects leave when autosave fails', async () => {
  const stores = createStores();
  const { registry, intervals, listeners } = setupEnv(stores);
  const calls = [];
  globalThis.window.IDFramework.dispatch = async (eventName, payload) => {
    calls.push({ eventName, payload });
    throw new Error('autosave failed');
  };

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-stub');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-stub');
  await import('../idframework/components/id-note-editor.js?case=editor-autosave');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  const instance = new Ctor();
  instance.connectedCallback();

  const autosaveInterval = intervals.find((entry) => entry.delay === 5000);
  assert.ok(autosaveInterval, 'expected a 5000ms autosave interval');

  stores.note.editor.form.title = 'Dirty draft';
  await autosaveInterval.fn();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].eventName, 'saveDraft');
  assert.equal(stores.note.editor.error, 'autosave failed');

  const beforeUnload = listeners.get('beforeunload');
  assert.equal(typeof beforeUnload, 'function');

  const event = {
    prevented: false,
    returnValue: '',
    preventDefault() {
      this.prevented = true;
    },
  };
  beforeUnload(event);

  assert.equal(event.prevented, true);
  assert.match(String(event.returnValue), /unsaved/i);
});

test('id-note-editor revokes local attachment preview URLs when a pending attachment is removed', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);
  const createdUrls = [];
  const revokedUrls = [];

  globalThis.URL = {
    createObjectURL(file) {
      const next = 'blob:' + file.name;
      createdUrls.push(next);
      return next;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-remove-preview');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-remove-preview');
  await import('../idframework/components/id-note-editor.js?case=editor-remove-preview');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  const instance = new Ctor();
  instance.connectedCallback();
  instance._addPendingFiles([{ name: 'cover.png', type: 'image/png' }]);

  assert.deepEqual(createdUrls, ['blob:cover.png']);
  assert.equal(stores.note.editor.pendingAttachments.length, 1);
  assert.equal(stores.note.editor.pendingAttachments[0].blobUrl, 'blob:cover.png');

  instance._removePendingAt(0);

  assert.deepEqual(revokedUrls, ['blob:cover.png']);
  assert.deepEqual(stores.note.editor.pendingAttachments, []);
});

test('id-note-editor revokes remaining local attachment preview URLs on disconnect', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);
  const revokedUrls = [];

  globalThis.URL = {
    createObjectURL(file) {
      return 'blob:' + file.name;
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  };

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-disconnect-preview');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-disconnect-preview');
  await import('../idframework/components/id-note-editor.js?case=editor-disconnect-preview');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  const instance = new Ctor();
  instance.connectedCallback();
  instance._addPendingFiles([
    { name: 'cover.png', type: 'image/png' },
    { name: 'doc.pdf', type: 'application/pdf' },
  ]);

  instance.disconnectedCallback();

  assert.deepEqual(revokedUrls, ['blob:cover.png', 'blob:doc.pdf']);
});

test('id-note-editor renders text fields and private toggle with dedicated classes', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-render-classes');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-render-classes');
  await import('../idframework/components/id-note-editor.js?case=editor-render-classes');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  const instance = new Ctor();
  instance.connectedCallback();

  const html = instance.shadowRoot.innerHTML;
  assert.match(html, /class="field-input"/);
  assert.match(html, /class="toggle-input"/);
  assert.match(html, /class="toggle-copy"/);
  assert.match(html, /id-note-cover-picker/);
});

test('id-note-editor uploads a data-url cover before publish and forwards the metafile URI', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);
  const calls = [];

  globalThis.Blob = globalThis.Blob || class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || '';
      this.size = parts.reduce((sum, part) => sum + String(part).length, 0);
    }
  };
  globalThis.File = class File extends Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
  globalThis.atob = globalThis.atob || ((value) => Buffer.from(value, 'base64').toString('binary'));

  globalThis.window.IDFramework.dispatch = async (eventName, payload) => {
    calls.push({ eventName, payload });
    if (eventName === 'uploadNoteAttachment') {
      return 'metafile://cover-uploaded-1.png';
    }
    if (eventName === 'createNote') {
      return { pinRes: { data: { pinId: 'p'.repeat(64) } } };
    }
    throw new Error('unexpected command: ' + eventName);
  };
  globalThis.window.location = { pathname: '/demo-note/index.html', search: '' };
  globalThis.window.history = { pushState() {} };
  globalThis.window.dispatchEvent = () => true;

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-cover-upload');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-cover-upload');
  await import('../idframework/components/id-note-editor.js?case=editor-cover-upload');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  stores.note.editor.form.coverImg = 'data:image/png;base64,Zm9v';
  stores.note.editor.form.title = 'Cover note';

  const instance = new Ctor();
  instance.connectedCallback();
  await instance._publish();

  assert.equal(calls.length, 2);
  assert.equal(calls[0].eventName, 'uploadNoteAttachment');
  assert.equal(calls[0].payload.file.name, 'cover-note-cover.png');
  assert.equal(calls[1].eventName, 'createNote');
  assert.equal(calls[1].payload.form.coverImg, 'metafile://cover-uploaded-1.png');
});

test('id-note-editor updates field state without forcing a full re-render on each keystroke', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-no-rerender');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-no-rerender');
  await import('../idframework/components/id-note-editor.js?case=editor-no-rerender');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  const instance = new Ctor();
  const harness = createEditorShadowHarness();
  instance.shadowRoot = harness;
  instance.connectedCallback();

  let renderCount = 0;
  const originalRender = instance.render.bind(instance);
  instance.render = () => {
    renderCount += 1;
    return originalRender();
  };

  instance._updateField('title', 'A');

  assert.equal(renderCount, 0);
  assert.equal(stores.note.editor.form.title, 'A');
  assert.equal(harness.refs.titleInput.value, 'A');
});

test('id-note-editor syncs pending attachments onto the attachment picker instance', async () => {
  const stores = createStores();
  const { registry } = setupEnv(stores);

  globalThis.URL = {
    createObjectURL(file) {
      return 'blob:' + file.name;
    },
    revokeObjectURL() {},
  };

  await import('../idframework/components/id-note-markdown-editor.js?case=editor-markdown-picker-sync');
  await import('../idframework/components/id-note-attachment-picker.js?case=editor-picker-sync');
  await import('../idframework/components/id-note-editor.js?case=editor-picker-sync');
  const Ctor = registry.get('id-note-editor');
  assert.ok(Ctor, 'id-note-editor should be registered');

  const instance = new Ctor();
  const harness = createEditorShadowHarness();
  instance.shadowRoot = harness;
  instance.connectedCallback();
  instance._addPendingFiles([{ name: 'photo.png', type: 'image/png' }]);

  assert.equal(stores.note.editor.pendingAttachments.length, 1);
  assert.equal(harness.refs.attachmentPicker.items.length, 1);
  assert.equal(harness.refs.attachmentPicker.items[0].name, 'photo.png');
  assert.equal(harness.refs.attachmentPicker.items[0].blobUrl, 'blob:photo.png');
});
