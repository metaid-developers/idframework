import test from 'node:test';
import assert from 'node:assert/strict';

import { NoteDraftDB } from '../idframework/stores/note/draft-db.js';
import SaveDraftCommand from '../idframework/commands/SaveDraftCommand.js';

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

function createIndexedDBLikeStorage() {
  const storage = createMemoryStorage();

  return {
    ...storage,
    async put(storeName, value) {
      if (Object.prototype.hasOwnProperty.call(value, 'id') && !Number.isFinite(value.id)) {
        const error = new Error(
          "Failed to execute 'put' on 'IDBObjectStore': Evaluating the object store's key path yielded a value that is not a valid key."
        );
        error.name = 'DataError';
        throw error;
      }
      return await storage.put(storeName, value);
    },
  };
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
      items: [],
      currentDraftId: null,
      isLoading: false,
      error: '',
    },
  };
}

test('SaveDraftCommand upserts the draft and replaces pending media rows for autosave', async () => {
  const stores = createStores();
  const draftDB = new NoteDraftDB({ storage: createMemoryStorage() });
  const command = new SaveDraftCommand({ draftDB });

  const first = await command.execute({
    payload: {
      form: {
        title: 'Draft title',
        subtitle: 'Draft subtitle',
        coverImg: 'metafile://cover-1.png',
        content: 'Draft body',
        tags: ['demo'],
      },
      pendingAttachments: [
        {
          blobUrl: 'blob:first-1',
          file: { mock: true },
          type: 'image/png',
          name: 'first.png',
          mediaId: 'media-first-1',
        },
        {
          blobUrl: 'blob:first-2',
          file: { mock: true },
          type: 'image/png',
          name: 'second.png',
          mediaId: 'media-first-2',
        },
      ],
    },
    stores,
  });

  assert.ok(Number.isFinite(first.draftId));
  assert.equal(stores.note.editor.currentDraftId, first.draftId);
  assert.equal(stores.draft.currentDraftId, first.draftId);

  assert.equal((await draftDB.getMediaFilesByDraftId(first.draftId)).length, 2);

  await command.execute({
    payload: {
      draftId: first.draftId,
      form: {
        title: 'Draft updated',
        subtitle: '',
        coverImg: '',
        content: 'Draft body v2',
        tags: [],
      },
      pendingAttachments: [
        {
          blobUrl: 'blob:second-1',
          file: { mock: true },
          type: 'image/png',
          name: 'only.png',
          mediaId: 'media-second-1',
        },
      ],
    },
    stores,
  });

  const draft = await draftDB.getDraft(first.draftId);
  assert.equal(draft.title, 'Draft updated');

  const media = await draftDB.getMediaFilesByDraftId(first.draftId);
  assert.equal(media.length, 1);
  assert.equal(media[0].blobUrl, 'blob:second-1');
  assert.equal(media[0].mediaId, 'media-second-1');
});

test('SaveDraftCommand omits inline id keys for new drafts and pending media rows under IndexedDB semantics', async () => {
  const stores = createStores();
  const draftDB = new NoteDraftDB({ storage: createIndexedDBLikeStorage() });
  const command = new SaveDraftCommand({ draftDB });

  const result = await command.execute({
    payload: {
      form: {
        title: 'Fresh draft',
        subtitle: '',
        coverImg: '',
        content: 'Hello',
        tags: [],
      },
      pendingAttachments: [
        {
          blobUrl: 'blob:cover-1',
          file: { mock: true },
          type: 'image/png',
          name: 'cover.png',
          mediaId: 'pending-cover-1',
        },
      ],
    },
    stores,
  });

  assert.ok(Number.isFinite(result.draftId));
  const savedDraft = await draftDB.getDraft(result.draftId);
  const mediaFiles = await draftDB.getMediaFilesByDraftId(result.draftId);

  assert.equal(savedDraft.title, 'Fresh draft');
  assert.equal(mediaFiles.length, 1);
  assert.equal(mediaFiles[0].mediaId, 'pending-cover-1');
});
