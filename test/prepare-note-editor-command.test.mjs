import test from 'node:test';
import assert from 'node:assert/strict';

import { NoteDraftDB } from '../idframework/stores/note/draft-db.js';
import PrepareNoteEditorCommand from '../idframework/commands/PrepareNoteEditorCommand.js';

function createMemoryStorage() {
  const stores = {
    drafts: new Map(),
    mediaFiles: new Map(),
  };
  const counters = {
    drafts: 1,
    mediaFiles: 1,
  };

  return {
    async put(storeName, value) {
      const nextValue = { ...value };
      if (!nextValue.id) {
        nextValue.id = counters[storeName];
        counters[storeName] += 1;
      }
      stores[storeName].set(nextValue.id, nextValue);
      return nextValue.id;
    },

    async get(storeName, key) {
      return stores[storeName].get(key) || null;
    },

    async getAll(storeName) {
      return Array.from(stores[storeName].values());
    },

    async getAllByIndex(storeName, indexName, value) {
      return Array.from(stores[storeName].values()).filter((item) => item[indexName] === value);
    },

    async delete(storeName, key) {
      stores[storeName].delete(key);
    },

    async deleteByIndex(storeName, indexName, value) {
      Array.from(stores[storeName].entries()).forEach(([key, item]) => {
        if (item[indexName] === value) stores[storeName].delete(key);
      });
    },
  };
}

function createStores() {
  return {
    wallet: { address: 'author-1' },
    note: {
      route: { path: '/', view: 'list', params: {}, query: {} },
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
    },
    draft: {
      items: [],
      currentDraftId: null,
      isLoading: false,
      error: '',
    },
  };
}

test('PrepareNoteEditorCommand restores the latest unbound draft on /note/new', async () => {
  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => (now += 1);

  try {
    const stores = createStores();
    const draftDB = new NoteDraftDB({ storage: createMemoryStorage() });

    await draftDB.saveDraft({
      title: 'Bound draft',
      subtitle: '',
      coverImg: '',
      content: 'Bound body',
      tags: [],
      pinId: 'note-pin-bound',
    });

    const unboundId = await draftDB.saveDraft({
      title: 'Latest unbound',
      subtitle: 'Sub',
      coverImg: 'metafile://cover-1.png',
      content: 'Draft content',
      tags: ['demo'],
      pinId: '',
    });
    await draftDB.saveMediaFile({
      draftId: unboundId,
      blobUrl: 'blob:demo-1',
      file: { mock: true },
      type: 'image/png',
      name: 'demo.png',
      mediaId: 'media-1',
      pinId: '',
    });

    stores.note.route = { path: '/note/new', view: 'editor', params: {}, query: {} };

    const command = new PrepareNoteEditorCommand({ draftDB });
    await command.execute({
      payload: { route: stores.note.route },
      stores,
      delegate: async () => {
        throw new Error('delegate should not be called for create mode');
      },
    });

    assert.equal(stores.note.editor.mode, 'create');
    assert.equal(stores.note.editor.currentDraftId, unboundId);
    assert.equal(stores.draft.currentDraftId, unboundId);
    assert.equal(stores.note.editor.form.title, 'Latest unbound');
    assert.equal(stores.note.editor.form.subtitle, 'Sub');
    assert.equal(stores.note.editor.form.coverImg, 'metafile://cover-1.png');
    assert.equal(stores.note.editor.form.content, 'Draft content');
    assert.deepEqual(stores.note.editor.form.tags, ['demo']);
    assert.equal(stores.note.editor.pendingAttachments.length, 1);
    assert.equal(stores.note.editor.pendingAttachments[0].blobUrl, 'blob:demo-1');
  } finally {
    Date.now = originalNow;
  }
});

test('PrepareNoteEditorCommand prefers the bound draft and blocks edit when encrypted content cannot be decrypted', async () => {
  const stores = createStores();
  const draftDB = new NoteDraftDB({ storage: createMemoryStorage() });
  const boundId = await draftDB.saveDraft({
    title: 'Draft wins',
    subtitle: '',
    coverImg: '',
    content: 'Draft content',
    tags: [],
    pinId: 'note-pin-1',
  });

  stores.note.route = { path: '/note/note-pin-1/edit', view: 'editor', params: { id: 'note-pin-1' }, query: {} };

  globalThis.window = {
    metaidwallet: {
      eciesDecrypt: async () => ({ status: 'error', result: '' }),
    },
  };

  const command = new PrepareNoteEditorCommand({ draftDB });
  await command.execute({
    payload: { route: stores.note.route },
    stores,
    delegate: async (service, endpoint) => {
      assert.equal(service, 'metaid_man');
      assert.equal(endpoint, '/pin/note-pin-1');
      return {
        data: {
          id: 'note-pin-1',
          address: 'author-1',
          contentSummary: JSON.stringify({
            title: 'Server title',
            content: 'ciphertext',
            encryption: '1',
            attachments: [],
          }),
        },
      };
    },
  });

  assert.equal(stores.note.editor.mode, 'edit');
  assert.equal(stores.note.editor.pinId, 'note-pin-1');
  assert.equal(stores.note.editor.currentDraftId, boundId);
  assert.equal(stores.note.editor.form.title, 'Draft wins');
  assert.ok(stores.note.editor.error.toLowerCase().includes('decrypt'));
});

test('PrepareNoteEditorCommand returns a blocked editor result when encrypted content cannot be decrypted and no draft exists', async () => {
  const stores = createStores();
  stores.wallet.address = 'author-2';
  stores.note.route = { path: '/note/note-pin-2/edit', view: 'editor', params: { id: 'note-pin-2' }, query: {} };

  globalThis.window = {
    metaidwallet: {
      eciesDecrypt: async () => ({ status: 'error', result: '' }),
    },
  };

  const command = new PrepareNoteEditorCommand({ draftDB: new NoteDraftDB({ storage: createMemoryStorage() }) });
  const result = await command.execute({
    payload: { route: stores.note.route },
    stores,
    delegate: async () => ({
      data: {
        id: 'note-pin-2',
        address: 'author-2',
        contentSummary: JSON.stringify({
          title: 'Encrypted server title',
          content: 'ciphertext',
          encryption: '1',
          attachments: ['metafile://attachment-1'],
        }),
      },
    }),
  });

  assert.equal(result.blocked, true);
  assert.equal(result.redirectPath, '/note/note-pin-2');
  assert.equal(stores.note.editor.currentDraftId, null);
  assert.equal(stores.note.editor.form.title, '');
  assert.equal(stores.note.editor.form.content, '');
  assert.deepEqual(stores.note.editor.existingAttachments, []);
  assert.ok(stores.note.editor.error.toLowerCase().includes('decrypt'));
});
