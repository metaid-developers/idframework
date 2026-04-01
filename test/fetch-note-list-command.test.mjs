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

test('FetchNoteListCommand derives backend size from pageSize when size is omitted', async () => {
  const command = new FetchNoteListCommand();
  const calls = [];

  await command.execute({
    payload: {
      cursor: '0',
      page: 1,
      pageSize: 7,
      currentCursor: '0',
      cursorHistory: ['0'],
    },
    stores: {
      note: {
        publicList: {
          items: [],
          cursor: '0',
          hasMore: true,
          isLoading: false,
          error: '',
          page: 1,
          pageSize: 20,
          currentCursor: '0',
          cursorHistory: ['0'],
        },
      },
    },
    delegate: async (service, endpoint) => {
      calls.push({ service, endpoint });
      return {
        data: {
          list: [],
          nextCursor: '',
          total: 0,
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, 'metaid_man');
  assert.equal(calls[0].endpoint, '/pin/path/list?path=%2Fprotocols%2Fsimplenote&cursor=0&size=7');
});

test('FetchNoteListCommand replaces items and syncs pagination state when replace mode is requested', async () => {
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
      page: 1,
      pageSize: 20,
      currentCursor: '0',
      cursorHistory: ['0'],
    },
  };

  const result = await command.execute({
    payload: {
      cursor: 'cursor-1',
      size: 12,
      replace: true,
      page: 2,
      pageSize: 12,
      currentCursor: 'cursor-1',
      cursorHistory: ['0', 'cursor-1'],
    },
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
        nextCursor: 'cursor-2',
        total: 2,
      },
    }),
  });

  assert.equal(noteStore.publicList.items.length, 1);
  assert.equal(noteStore.publicList.items[0].pin.id, 'note-pin-2');
  assert.equal(noteStore.publicList.cursor, 'cursor-2');
  assert.equal(noteStore.publicList.page, 2);
  assert.equal(noteStore.publicList.pageSize, 12);
  assert.equal(noteStore.publicList.currentCursor, 'cursor-1');
  assert.deepEqual(noteStore.publicList.cursorHistory, ['0', 'cursor-1']);
  assert.equal(result.items.length, 1);
  assert.equal(result.page, 2);
});

test('FetchNoteListCommand honors replace-mode pagination metadata', async () => {
  const command = new FetchNoteListCommand();
  const noteStore = {
    publicList: {
      items: [{ pin: { id: 'note-pin-0' }, noteData: { title: 'Old note' } }],
      cursor: 'cursor-shadow',
      hasMore: true,
      isLoading: false,
      error: '',
      page: 1,
      pageSize: 20,
      currentCursor: 'cursor-0',
      cursorHistory: ['cursor-00'],
    },
  };

  const result = await command.execute({
    payload: {
      replace: true,
      page: 2,
      pageSize: 12,
      cursor: 'cursor-1',
      currentCursor: 'cursor-1',
      cursorHistory: ['cursor-0'],
    },
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
        nextCursor: 'cursor-2',
        total: 3,
      },
    }),
  });

  assert.equal(noteStore.publicList.items.length, 1);
  assert.equal(noteStore.publicList.items[0].pin.id, 'note-pin-2');
  assert.equal(noteStore.publicList.page, 2);
  assert.equal(noteStore.publicList.pageSize, 12);
  assert.equal(noteStore.publicList.currentCursor, 'cursor-1');
  assert.deepEqual(noteStore.publicList.cursorHistory, ['cursor-0']);
  assert.equal(noteStore.publicList.cursor, 'cursor-2');
  assert.equal(noteStore.publicList.hasMore, true);
  assert.equal(result.items.length, 1);
});
