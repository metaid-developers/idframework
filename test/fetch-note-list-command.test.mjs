import test from 'node:test';
import assert from 'node:assert/strict';

import FetchNoteListCommand from '../idframework/commands/FetchNoteListCommand.js';

test('FetchNoteListCommand uses /pin/path/list with simplenote path', async () => {
  const command = new FetchNoteListCommand();
  const calls = [];
  const noteStore = {
    publicList: {
      items: [],
      cursor: 0,
      hasMore: true,
      isLoading: false,
      error: 'stale',
    },
  };

  const result = await command.execute({
    payload: { cursor: 0, size: 12 },
    stores: { note: noteStore },
    delegate: async (service, endpoint, options) => {
      calls.push({ service, endpoint, options });
      return {
        code: 1,
        data: {
          list: [
            {
              id: 'note-pin-1',
              address: '1author',
              contentSummary: JSON.stringify({
                title: 'First note',
                content: 'Body',
                encryption: '0',
              }),
            },
          ],
          nextCursor: 'cursor-2',
          total: 9,
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, 'metaid_man');
  assert.equal(calls[0].endpoint, '/pin/path/list?path=%2Fprotocols%2Fsimplenote&cursor=0&size=12');
  assert.deepEqual(calls[0].options, { method: 'GET' });
  assert.equal(noteStore.publicList.isLoading, false);
  assert.equal(noteStore.publicList.error, '');
  assert.equal(noteStore.publicList.cursor, 'cursor-2');
  assert.equal(noteStore.publicList.hasMore, true);
  assert.equal(noteStore.publicList.items.length, 1);
  assert.equal(noteStore.publicList.items[0].noteData.title, 'First note');
  assert.equal(result.items.length, 1);
});

test('FetchNoteListCommand appends follow-up pages to existing public list items', async () => {
  const command = new FetchNoteListCommand();
  const existingItem = {
    pin: { id: 'note-pin-1', address: '1author' },
    noteData: { title: 'Existing note' },
  };
  const noteStore = {
    publicList: {
      items: [existingItem],
      cursor: 'cursor-1',
      hasMore: true,
      isLoading: false,
      error: '',
    },
  };

  const result = await command.execute({
    payload: { cursor: 'cursor-1', size: 12 },
    stores: { note: noteStore },
    delegate: async () => ({
      data: {
        list: [
          {
            id: 'note-pin-2',
            address: '1author-2',
            contentSummary: {
              title: 'Second note',
              content: 'Body 2',
              encryption: '0',
            },
          },
        ],
        nextCursor: '',
        total: 2,
      },
    }),
  });

  assert.equal(noteStore.publicList.items.length, 2);
  assert.equal(noteStore.publicList.items[0].pin.id, 'note-pin-1');
  assert.equal(noteStore.publicList.items[1].pin.id, 'note-pin-2');
  assert.equal(noteStore.publicList.hasMore, false);
  assert.equal(result.items.length, 2);
});
