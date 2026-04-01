import test from 'node:test';
import assert from 'node:assert/strict';

import DecryptNoteContentCommand from '../idframework/commands/DecryptNoteContentCommand.js';
import { ENCRYPTED_NOTE_PLACEHOLDER } from '../idframework/utils/note-crypto.js';

test('DecryptNoteContentCommand uses note crypto helper and falls back to encrypted placeholder for non-owner note', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    metaidwallet: {
      async eciesDecrypt() {
        throw new Error('should not decrypt for non-owner note');
      },
    },
  };

  try {
    const command = new DecryptNoteContentCommand();
    const result = await command.execute({
      payload: {
        noteData: {
          title: 'Encrypted note',
          content: 'cipher',
          encryption: '1',
        },
        noteAddress: '1author',
      },
      stores: {
        wallet: {
          address: '1viewer',
        },
      },
    });

    assert.equal(result.content, ENCRYPTED_NOTE_PLACEHOLDER);
    assert.equal(result.title, 'Encrypted note');
  } finally {
    globalThis.window = originalWindow;
  }
});
