import test from 'node:test';
import assert from 'node:assert/strict';

import FetchNoteDetailCommand from '../idframework/commands/FetchNoteDetailCommand.js';

test('FetchNoteDetailCommand parses note detail and preserves pin address', async () => {
  const command = new FetchNoteDetailCommand();
  const noteStore = {
    detail: {
      pinId: '',
      pin: null,
      noteData: null,
      author: null,
      isLoading: false,
      error: '',
    },
  };

  const result = await command.execute({
    payload: { numberOrId: 'note-pin-3' },
    stores: { note: noteStore },
    delegate: async (service, endpoint, options) => {
      assert.equal(service, 'metaid_man');
      assert.equal(endpoint, '/pin/note-pin-3');
      assert.deepEqual(options, { method: 'GET' });
      return {
        data: {
          id: 'note-pin-3',
          address: '1detail-author',
          contentSummary: '{"title":"Detail title","content":"Detail body","attachments":["metafile://abc.png"]}',
        },
      };
    },
  });

  assert.equal(noteStore.detail.isLoading, false);
  assert.equal(noteStore.detail.error, '');
  assert.equal(noteStore.detail.pinId, 'note-pin-3');
  assert.equal(noteStore.detail.pin.address, '1detail-author');
  assert.equal(noteStore.detail.noteData.title, 'Detail title');
  assert.deepEqual(noteStore.detail.noteData.attachments, ['metafile://abc.png']);
  assert.equal(result.pin.address, '1detail-author');
});

test('FetchNoteDetailCommand clears stale author and accepts full-detail payload fields', async () => {
  const command = new FetchNoteDetailCommand();
  const noteStore = {
    detail: {
      pinId: 'note-pin-3',
      pin: { id: 'note-pin-3', address: '1detail-author' },
      noteData: {
        title: 'Old note',
      },
      author: { name: 'Alice' },
      isLoading: false,
      error: '',
    },
  };

  const result = await command.execute({
    payload: { numberOrId: 'note-pin-4' },
    stores: { note: noteStore },
    delegate: async () => ({
      data: {
        id: 'note-pin-4',
        address: '1next-author',
        title: 'Top-level detail title',
        subtitle: 'Top-level subtitle',
        content: 'Top-level body',
        attachments: ['metafile://detail-file.png'],
      },
    }),
  });

  assert.equal(noteStore.detail.pinId, 'note-pin-4');
  assert.equal(noteStore.detail.author, null);
  assert.equal(noteStore.detail.noteData.title, 'Top-level detail title');
  assert.equal(noteStore.detail.noteData.subtitle, 'Top-level subtitle');
  assert.equal(noteStore.detail.noteData.content, 'Top-level body');
  assert.deepEqual(noteStore.detail.noteData.attachments, ['metafile://detail-file.png']);
  assert.equal(result.noteData.title, 'Top-level detail title');
});
