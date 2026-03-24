import test from 'node:test';
import assert from 'node:assert/strict';

import FetchPrivateMessagesCommand from '../idframework/commands/FetchPrivateMessagesCommand.js';

test('FetchPrivateMessagesCommand fetches private messages by index and stores normalized result', async () => {
  const command = new FetchPrivateMessagesCommand();

  const chatStore = {
    messages: {},
    isLoading: false,
    error: null,
  };

  globalThis.fetch = async (url) => {
    const text = String(url);
    assert.ok(text.includes('/private-chat-list-by-index?'));
    assert.ok(text.includes('metaId=self_metaid'));
    assert.ok(text.includes('otherMetaId=peer_metaid'));

    return {
      ok: true,
      async json() {
        return {
          code: 0,
          data: {
            list: [
              {
                txId: 'tx_1',
                pinId: 'pin_1',
                content: 'cipher_1',
                timestamp: 1711000000,
                index: 12,
                fromGlobalMetaId: 'peer_metaid',
                toGlobalMetaId: 'self_metaid',
              },
            ],
          },
        };
      },
    };
  };

  await command.execute({
    payload: {
      metaId: 'self_metaid',
      otherMetaId: 'peer_metaid',
      startIndex: 12,
      size: 20,
    },
    stores: {
      chat: chatStore,
    },
  });

  assert.ok(Array.isArray(chatStore.messages.peer_metaid));
  assert.equal(chatStore.messages.peer_metaid.length, 1);
  assert.equal(chatStore.messages.peer_metaid[0].id, 'pin_1');
  assert.equal(chatStore.messages.peer_metaid[0].type, '2');
  assert.equal(chatStore.messages.peer_metaid[0].content, 'cipher_1');
});

test('FetchPrivateMessagesCommand prepend merge keeps existing rows and avoids global loading flip', async () => {
  const command = new FetchPrivateMessagesCommand();

  const chatStore = {
    messages: {
      peer_metaid: [
        {
          id: 'pin_12',
          pinId: 'pin_12',
          protocol: '/protocols/simplemsg',
          type: '2',
          content: 'old-12',
          timestamp: 1711000012,
          index: 12,
          fromGlobalMetaId: 'peer_metaid',
          toGlobalMetaId: 'self_metaid',
        },
        {
          id: 'pin_20',
          pinId: 'pin_20',
          protocol: '/protocols/simplemsg',
          type: '2',
          content: 'old-20',
          timestamp: 1711000020,
          index: 20,
          fromGlobalMetaId: 'peer_metaid',
          toGlobalMetaId: 'self_metaid',
        },
      ],
    },
    isLoading: false,
    error: null,
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const text = String(url);
    assert.ok(text.includes('startIndex=0'));
    return {
      ok: true,
      async json() {
        return {
          data: {
            list: [
              {
                pinId: 'pin_8',
                content: 'older-8',
                timestamp: 1711000008,
                index: 8,
                createGlobalMetaId: 'peer_metaid',
                chain: 'dogecoin',
              },
              {
                pinId: 'pin_12',
                content: 'new-12',
                timestamp: 1711000012,
                index: 12,
                fromGlobalMetaId: 'peer_metaid',
                toGlobalMetaId: 'self_metaid',
              },
            ],
          },
        };
      },
    };
  };

  try {
    const rows = await command.execute({
      payload: {
        metaId: 'self_metaid',
        otherMetaId: 'peer_metaid',
        startIndex: 0,
        size: 20,
        mergeMode: 'prepend',
      },
      stores: {
        chat: chatStore,
      },
    });

    assert.equal(chatStore.isLoading, false);
    assert.equal(chatStore.error, null);
    assert.ok(Array.isArray(rows));
    assert.deepEqual(rows.map((row) => Number(row.index || 0)), [8, 12, 20]);
    assert.equal(rows[0].chain, 'doge');
    assert.equal(rows[1].content, 'new-12');
    assert.equal(chatStore.messages.peer_metaid.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
