import test from 'node:test';
import assert from 'node:assert/strict';

import { NoteDraftDB } from '../idframework/stores/note/draft-db.js';

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

test('note draft db saves and restores draft attachments by draftId', async () => {
  const db = new NoteDraftDB({ storage: createMemoryStorage() });

  const draftId = await db.saveDraft({
    title: 'Draft title',
    subtitle: 'Draft subtitle',
    coverImg: 'metafile://cover123.png',
    content: 'Draft body',
    tags: ['demo'],
    pinId: '',
  });

  await db.saveMediaFile({
    draftId,
    blobUrl: 'blob:demo-1',
    file: { mock: true },
    type: 'image/png',
    name: 'cover.png',
    mediaId: 'media-1',
    pinId: '',
  });

  await db.saveMediaFile({
    draftId: draftId + 1,
    blobUrl: 'blob:demo-2',
    file: { mock: true },
    type: 'image/png',
    name: 'other.png',
    mediaId: 'media-2',
    pinId: '',
  });

  const draft = await db.getDraft(draftId);
  const mediaFiles = await db.getMediaFilesByDraftId(draftId);

  assert.equal(draft.title, 'Draft title');
  assert.ok(Number.isFinite(draft.createdAt));
  assert.ok(Number.isFinite(draft.updatedAt));
  assert.equal(mediaFiles.length, 1);
  assert.equal(mediaFiles[0].draftId, draftId);
  assert.equal(mediaFiles[0].blobUrl, 'blob:demo-1');
  assert.equal(mediaFiles[0].mediaId, 'media-1');
});
