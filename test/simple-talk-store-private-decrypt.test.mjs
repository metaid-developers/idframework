import test from 'node:test';
import assert from 'node:assert/strict';

import { SimpleTalkStore } from '../idframework/stores/chat/simple-talk.js';

function createCryptoStub(secretMap) {
  return {
    enc: {
      Utf8: { name: 'Utf8' },
      Hex: {
        parse(value) {
          return String(value || '');
        },
      },
    },
    mode: {
      CBC: { name: 'CBC' },
    },
    pad: {
      Pkcs7: { name: 'Pkcs7' },
    },
    AES: {
      decrypt(_cipherText, secretKey) {
        const resolved = secretMap.get(String(secretKey || '')) || '';
        return {
          toString() {
            return resolved;
          },
        };
      },
    },
  };
}

test('SimpleTalkStore private decrypt resolves peer from createGlobalMetaId when from/to are missing', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    CryptoJS: createCryptoStub(new Map([
      ['secret-from-create', 'decrypted from createGlobalMetaId'],
    ])),
  };

  try {
    const store = new SimpleTalkStore();
    store.selfGlobalMetaId = 'self_global_metaid';
    store.context = { mode: 'private', groupId: '', targetGlobalMetaId: '' };

    let resolvedPeer = '';
    store.getSharedSecret = async (peerGlobalMetaId) => {
      resolvedPeer = String(peerGlobalMetaId || '');
      return resolvedPeer === 'peer_from_create' ? 'secret-from-create' : '';
    };

    const decrypted = await store.decryptText({
      protocol: '/protocols/simplemsg',
      content: 'ciphertext',
      createGlobalMetaId: 'peer_from_create',
      userInfo: {
        globalMetaId: 'peer_from_create',
      },
    });

    assert.equal(resolvedPeer, 'peer_from_create');
    assert.equal(decrypted, 'decrypted from createGlobalMetaId');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('SimpleTalkStore private decrypt uses message chatPublicKey before fetchUserInfo fallback', async () => {
  const previousWindow = globalThis.window;
  let fetchUserInfoCalls = 0;
  let ecdhCalls = 0;

  globalThis.window = {
    CryptoJS: createCryptoStub(new Map([
      ['secret-from-inline-pubkey', 'decrypted from inline chat key'],
    ])),
    IDFramework: {
      dispatch: async () => {
        fetchUserInfoCalls += 1;
        return {};
      },
    },
    metaidwallet: {
      common: {
        ecdh: async ({ externalPubKey }) => {
          ecdhCalls += 1;
          assert.equal(externalPubKey, 'inline-peer-chat-pubkey');
          return { sharedSecret: 'secret-from-inline-pubkey' };
        },
      },
    },
  };

  try {
    const store = new SimpleTalkStore();
    store.selfGlobalMetaId = 'self_global_metaid';
    store.context = { mode: 'private', groupId: '', targetGlobalMetaId: 'peer_inline_pubkey' };

    const decrypted = await store.decryptText({
      protocol: '/protocols/simplemsg',
      content: 'ciphertext-inline',
      fromGlobalMetaId: 'peer_inline_pubkey',
      userInfo: {
        globalMetaId: 'peer_inline_pubkey',
        chatPublicKey: 'inline-peer-chat-pubkey',
      },
    });

    assert.equal(decrypted, 'decrypted from inline chat key');
    assert.equal(fetchUserInfoCalls, 0);
    assert.equal(ecdhCalls, 1);
  } finally {
    globalThis.window = previousWindow;
  }
});
