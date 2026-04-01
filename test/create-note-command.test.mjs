import test from 'node:test';
import assert from 'node:assert/strict';

import { NoteDraftDB } from '../idframework/stores/note/draft-db.js';
import CreateNoteCommand from '../idframework/commands/CreateNoteCommand.js';

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
    wallet: { address: 'wallet-1' },
    user: { user: { address: 'wallet-1' } },
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
      items: [],
      currentDraftId: null,
      isLoading: false,
      error: '',
    },
  };
}

test('CreateNoteCommand writes /protocols/simplenote JSON body through createPin', async () => {
  const stores = createStores();
  const calls = [];
  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async (args) => {
          calls.push(args);
          return { status: 'ok' };
        },
      },
    },
  };

  const command = new CreateNoteCommand();
  await command.execute({
    payload: {
      form: {
        title: 'Demo',
        subtitle: 'Sub',
        content: 'Hello',
        contentType: 'text/markdown',
        encryption: '0',
        coverImg: 'metafile://cover-1.png',
        createTime: 0,
        tags: ['demo'],
        attachments: ['metafile://old-1.png'],
      },
      pendingAttachments: ['metafile://new-2.png'],
    },
    stores,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.operation, 'create');
  assert.equal(calls[0].payload.path, '/protocols/simplenote');
  assert.equal(calls[0].payload.contentType, 'application/json');

  const body = JSON.parse(calls[0].payload.body);
  assert.equal(body.title, 'Demo');
  assert.equal(body.content, 'Hello');
  assert.equal(body.encryption, '0');
  assert.deepEqual(body.attachments, ['metafile://old-1.png', 'metafile://new-2.png']);
});

test('CreateNoteCommand encrypts private content with eciesEncrypt and deletes the bound draft after publish', async () => {
  const stores = createStores();
  const storage = createMemoryStorage();
  const draftDB = new NoteDraftDB({ storage });
  const draftId = await draftDB.saveDraft({
    title: 'Draft',
    subtitle: '',
    coverImg: '',
    content: 'Secret',
    tags: [],
    pinId: '',
  });
  await draftDB.saveMediaFile({
    draftId,
    blobUrl: 'blob:demo-1',
    file: { mock: true },
    type: 'image/png',
    name: 'demo.png',
    mediaId: 'media-1',
    pinId: '',
  });

  stores.note.editor.currentDraftId = draftId;
  stores.draft.currentDraftId = draftId;
  stores.draft.items = [{ id: draftId, title: 'Draft' }];

  const pinCalls = [];
  globalThis.window = {
    metaidwallet: {
      eciesEncrypt: async ({ message, walletAddress }) => {
        assert.equal(message, 'Secret');
        assert.equal(walletAddress, 'wallet-1');
        return { status: 'ok', result: 'ciphertext-1' };
      },
    },
    IDFramework: {
      BuiltInCommands: {
        createPin: async (args) => {
          pinCalls.push(args);
          return { status: 'ok', data: { pinId: 'created-pin' } };
        },
      },
    },
  };

  const command = new CreateNoteCommand({ draftDB });
  await command.execute({
    payload: {
      isPrivate: true,
      form: {
        title: 'Private',
        subtitle: '',
        content: 'Secret',
        contentType: 'text/markdown',
        encryption: '0',
        coverImg: '',
        createTime: 0,
        tags: [],
        attachments: [],
      },
      draftId,
    },
    stores,
  });

  assert.equal(pinCalls.length, 1);
  const body = JSON.parse(pinCalls[0].payload.body);
  assert.equal(body.content, 'ciphertext-1');
  assert.equal(body.encryption, '1');

  assert.equal(await draftDB.getDraft(draftId), null);
  assert.equal((await draftDB.getMediaFilesByDraftId(draftId)).length, 0);
  assert.equal(stores.note.editor.currentDraftId, null);
  assert.equal(stores.draft.currentDraftId, null);
  assert.deepEqual(stores.draft.items, []);
});

test("CreateNoteCommand treats form.encryption !== '0' as private even when isPrivate is omitted", async () => {
  const stores = createStores();
  const pinCalls = [];

  globalThis.window = {
    metaidwallet: {
      eciesEncrypt: async ({ message, walletAddress }) => {
        assert.equal(message, 'Secret');
        assert.equal(walletAddress, 'wallet-1');
        return { status: 'ok', result: 'ciphertext-2' };
      },
    },
    IDFramework: {
      BuiltInCommands: {
        createPin: async (args) => {
          pinCalls.push(args);
          return { status: 'ok' };
        },
      },
    },
  };

  const command = new CreateNoteCommand();
  await command.execute({
    payload: {
      form: {
        title: 'Private by form',
        subtitle: '',
        content: 'Secret',
        contentType: 'text/markdown',
        encryption: '1',
        coverImg: '',
        createTime: 0,
        tags: [],
        attachments: [],
      },
    },
    stores,
  });

  assert.equal(pinCalls.length, 1);
  const body = JSON.parse(pinCalls[0].payload.body);
  assert.equal(body.content, 'ciphertext-2');
  assert.equal(body.encryption, '1');
});
