import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  ENCRYPTED_NOTE_PLACEHOLDER,
  decryptNoteContent,
  encryptNoteContent,
} from '../idframework/utils/note-crypto.js';

async function encryptLegacyAesGcm(plainText, hexKey) {
  const iv = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const keyBytes = Uint8Array.from(Buffer.from(hexKey, 'hex'));
  const cryptoKey = await webcrypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const encrypted = await webcrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      tagLength: 128,
    },
    cryptoKey,
    new TextEncoder().encode(plainText)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(combined).toString('base64');
}

test('decrypt helper returns encrypted placeholder for non-owner note', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    metaidwallet: {
      async eciesDecrypt() {
        throw new Error('eciesDecrypt should not run for non-owner notes');
      },
    },
  };

  try {
    const result = await decryptNoteContent({
      noteData: {
        content: 'cipher-text',
        encryption: '1',
      },
      walletAddress: '1owner-current-user',
      noteAddress: '1note-author',
    });

    assert.equal(result.content, ENCRYPTED_NOTE_PLACEHOLDER);
    assert.equal(result.encryption, '1');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('decrypt helper returns encrypted placeholder when wallet address is unavailable', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    metaidwallet: {
      async eciesDecrypt() {
        throw new Error('eciesDecrypt should not run without an owner wallet match');
      },
    },
  };

  try {
    const result = await decryptNoteContent({
      noteData: {
        content: 'cipher-text',
        encryption: '1',
      },
      walletAddress: '',
      noteAddress: '1note-author',
    });

    assert.equal(result.content, ENCRYPTED_NOTE_PLACEHOLDER);
    assert.equal(result.encryption, '1');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('decrypt helper returns encrypted placeholder when note owner address is unavailable', async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    metaidwallet: {
      async eciesDecrypt() {
        throw new Error('eciesDecrypt should not run when note ownership cannot be verified');
      },
    },
  };

  try {
    const result = await decryptNoteContent({
      noteData: {
        content: 'cipher-text',
        encryption: '1',
      },
      walletAddress: '1owner-current-user',
      noteAddress: '',
    });

    assert.equal(result.content, ENCRYPTED_NOTE_PLACEHOLDER);
    assert.equal(result.encryption, '1');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('encrypt helper uses eciesEncrypt for private note payloads', async () => {
  const originalWindow = globalThis.window;
  const calls = [];
  globalThis.window = {
    metaidwallet: {
      async eciesEncrypt(payload) {
        calls.push(payload);
        return {
          status: 'ok',
          result: 'cipher-note',
        };
      },
    },
  };

  try {
    const result = await encryptNoteContent({
      noteData: {
        title: 'Secret note',
        content: 'very private body',
        encryption: '0',
      },
      isPrivate: true,
      walletAddress: '1owner-current-user',
    });

    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      message: 'very private body',
      walletAddress: '1owner-current-user',
    });
    assert.equal(result.content, 'cipher-note');
    assert.equal(result.encryption, '1');
    assert.equal(result.title, 'Secret note');
  } finally {
    globalThis.window = originalWindow;
  }
});

test('decrypt helper resolves legacy AES key from localStorage signKeys', async () => {
  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;
  const legacyKey = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
  const cipherText = await encryptLegacyAesGcm('legacy secret body', legacyKey);

  globalThis.window = originalWindow;
  globalThis.localStorage = {
    getItem(key) {
      if (key !== 'signKeys') return null;
      return JSON.stringify([
        {
          address: '1owner-current-user',
          sigKey: legacyKey,
        },
      ]);
    },
  };

  try {
    const result = await decryptNoteContent({
      noteData: {
        content: cipherText,
        encryption: 'aes',
      },
      walletAddress: '1owner-current-user',
      noteAddress: '1owner-current-user',
      cryptoObject: webcrypto,
    });

    assert.equal(result.content, 'legacy secret body');
    assert.equal(result.encryption, 'aes');
  } finally {
    globalThis.window = originalWindow;
    globalThis.localStorage = originalLocalStorage;
  }
});
