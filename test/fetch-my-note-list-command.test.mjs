import test from 'node:test';
import assert from 'node:assert/strict';

import FetchMyNoteListCommand from '../idframework/commands/FetchMyNoteListCommand.js';

test('FetchMyNoteListCommand uses /address/pin/list/:address with simplenote path', async () => {
  const command = new FetchMyNoteListCommand();
  const calls = [];
  const noteStore = {
    myList: {
      items: [],
      cursor: '',
      hasMore: true,
      isLoading: false,
      error: '',
    },
  };

  const result = await command.execute({
    payload: { address: '1owner', cursor: '2', size: 8 },
    stores: { note: noteStore },
    delegate: async (service, endpoint, options) => {
      calls.push({ service, endpoint, options });
      return {
        data: {
          list: [
            {
              id: 'note-pin-2',
              address: '1owner',
              contentSummary: {
                title: 'Owned note',
                subtitle: 'Mine',
                content: 'hello',
              },
            },
          ],
          nextCursor: '',
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, 'metaid_man');
  assert.equal(calls[0].endpoint, '/address/pin/list/1owner?path=%2Fprotocols%2Fsimplenote&cursor=2&size=8');
  assert.deepEqual(calls[0].options, { method: 'GET' });
  assert.equal(noteStore.myList.items.length, 1);
  assert.equal(noteStore.myList.items[0].noteData.title, 'Owned note');
  assert.equal(noteStore.myList.hasMore, false);
  assert.equal(result.items[0].pin.id, 'note-pin-2');
});

test('FetchMyNoteListCommand appends follow-up pages to existing owner notes', async () => {
  const command = new FetchMyNoteListCommand();
  const existingItem = {
    pin: { id: 'note-pin-2', address: '1owner' },
    noteData: { title: 'Owned note' },
  };
  const noteStore = {
    myList: {
      items: [existingItem],
      cursor: 'cursor-2',
      hasMore: true,
      isLoading: false,
      error: '',
    },
  };

  const result = await command.execute({
    payload: { address: '1owner', cursor: 'cursor-2', size: 8 },
    stores: { note: noteStore },
    delegate: async () => ({
      data: {
        list: [
          {
            id: 'note-pin-3',
            address: '1owner',
            contentSummary: JSON.stringify({
              title: 'Owned note 2',
              content: 'hello again',
            }),
          },
        ],
        nextCursor: '',
      },
    }),
  });

  assert.equal(noteStore.myList.items.length, 2);
  assert.equal(noteStore.myList.items[0].pin.id, 'note-pin-2');
  assert.equal(noteStore.myList.items[1].pin.id, 'note-pin-3');
  assert.equal(noteStore.myList.hasMore, false);
  assert.equal(result.items.length, 2);
});

test('FetchMyNoteListCommand derives backend size from pageSize when size is omitted', async () => {
  const command = new FetchMyNoteListCommand();
  const calls = [];

  await command.execute({
    payload: {
      address: '1owner',
      cursor: '0',
      page: 1,
      pageSize: 6,
      currentCursor: '0',
      cursorHistory: ['0'],
    },
    stores: {
      note: {
        myList: {
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
  assert.equal(calls[0].endpoint, '/address/pin/list/1owner?path=%2Fprotocols%2Fsimplenote&cursor=0&size=6');
});

test('FetchMyNoteListCommand replaces items and syncs pagination state when replace mode is requested', async () => {
  const command = new FetchMyNoteListCommand();
  const existingItem = {
    pin: { id: 'note-pin-2', address: '1owner' },
    noteData: { title: 'Owned note' },
  };
  const noteStore = {
    myList: {
      items: [existingItem],
      cursor: 'cursor-2',
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
      address: '1owner',
      cursor: 'cursor-2',
      size: 8,
      replace: true,
      page: 2,
      pageSize: 8,
      currentCursor: 'cursor-2',
      cursorHistory: ['0', 'cursor-2'],
    },
    stores: { note: noteStore },
    delegate: async () => ({
      data: {
        list: [
          {
            id: 'note-pin-3',
            address: '1owner',
            contentSummary: JSON.stringify({
              title: 'Owned note 2',
              content: 'hello again',
            }),
          },
        ],
        nextCursor: '',
      },
    }),
  });

  assert.equal(noteStore.myList.items.length, 1);
  assert.equal(noteStore.myList.items[0].pin.id, 'note-pin-3');
  assert.equal(noteStore.myList.page, 2);
  assert.equal(noteStore.myList.pageSize, 8);
  assert.equal(noteStore.myList.currentCursor, 'cursor-2');
  assert.deepEqual(noteStore.myList.cursorHistory, ['0', 'cursor-2']);
  assert.equal(result.items.length, 1);
  assert.equal(result.page, 2);
});
