import test from 'node:test';
import assert from 'node:assert/strict';

import UpdateNoteCommand from '../idframework/commands/UpdateNoteCommand.js';

function createStores() {
  return {
    wallet: { address: 'wallet-1' },
    user: { user: { address: 'wallet-1' } },
    note: {
      editor: {
        mode: 'edit',
        pinId: 'note-pin-1',
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

test('UpdateNoteCommand modifies @pinId and preserves retained attachments', async () => {
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

  const command = new UpdateNoteCommand();
  await command.execute({
    payload: {
      pinId: 'note-pin-1',
      form: {
        title: 'Updated',
        subtitle: '',
        content: 'Body',
        contentType: 'text/markdown',
        encryption: '0',
        coverImg: '',
        createTime: 0,
        tags: [],
        attachments: [],
      },
      existingAttachments: ['metafile://old-1.png'],
      pendingAttachments: ['metafile://new-2.jpg', 'metafile://new-2.jpg'],
    },
    stores,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.operation, 'modify');
  assert.equal(calls[0].payload.path, '@note-pin-1');
  assert.equal(calls[0].payload.contentType, 'application/json');

  const body = JSON.parse(calls[0].payload.body);
  assert.equal(body.title, 'Updated');
  assert.deepEqual(body.attachments, ['metafile://old-1.png', 'metafile://new-2.jpg']);
});

