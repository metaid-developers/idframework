import test from 'node:test';
import assert from 'node:assert/strict';

import ResolveNoteAuthorCommand from '../idframework/commands/ResolveNoteAuthorCommand.js';

test('ResolveNoteAuthorCommand loads author info by address and stores it on note detail', async () => {
  const command = new ResolveNoteAuthorCommand();
  const noteStore = {
    detail: {
      pinId: 'note-pin-3',
      pin: { address: '1detail-author' },
      noteData: null,
      author: null,
      isLoading: false,
      error: '',
    },
  };

  const result = await command.execute({
    payload: { address: '1detail-author' },
    stores: { note: noteStore },
    delegate: async (service, endpoint, options) => {
      assert.equal(service, 'metaid_man');
      assert.equal(endpoint, '/info/address/1detail-author');
      assert.deepEqual(options, { method: 'GET' });
      return {
        data: {
          address: '1detail-author',
          name: 'Alice',
          avatar: 'https://avatar.example/alice.png',
        },
      };
    },
  });

  assert.equal(noteStore.detail.author.name, 'Alice');
  assert.equal(result.avatar, 'https://avatar.example/alice.png');
});
