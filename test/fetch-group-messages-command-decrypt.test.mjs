import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv } from 'node:crypto';

import FetchGroupMessagesCommand from '../idframework/commands/FetchGroupMessagesCommand.js';

function encryptGroupTextToHex(plainText, groupId) {
  const key = Buffer.from(String(groupId || '').substring(0, 16).padEnd(16, '0'), 'utf8');
  const iv = Buffer.from('0000000000000000', 'utf8');
  const cipher = createCipheriv('aes-128-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(String(plainText || ''), 'utf8')), cipher.final()]);
  return encrypted.toString('hex');
}

test('FetchGroupMessagesCommand decrypts group text hex and preserves protocol', async () => {
  const command = new FetchGroupMessagesCommand();
  const groupId = 'group_1234567890abcdef';
  const encryptedHex = encryptGroupTextToHex('hello group', groupId);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: {
          list: [
            {
              protocol: '/protocols/simplegroupchat',
              content: encryptedHex,
              timestamp: 1711000000,
              index: 7,
              userInfo: {
                name: 'Alice',
              },
            },
          ],
        },
      };
    },
  });

  const chatStore = {
    isLoading: false,
    error: null,
    messages: {},
  };

  globalThis.window = {
    ServiceLocator: {
      idchat: 'https://api.idchat.io/chat-api/group-chat',
    },
    IDFramework: {
      dispatch: async () => {},
    },
  };

  try {
    await command.execute({
      payload: { groupId, startIndex: 0, size: 20 },
      stores: {
        chat: chatStore,
        user: { users: {} },
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const rows = chatStore.messages[groupId];
  assert.ok(Array.isArray(rows));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].content, 'hello group');
  assert.equal(rows[0].protocol, '/protocols/simplegroupchat');
});

test('FetchGroupMessagesCommand prepend merge keeps existing rows and avoids replace loading state', async () => {
  const command = new FetchGroupMessagesCommand();
  const groupId = 'group_merge_case';
  const originalFetch = globalThis.fetch;
  const dispatchCalls = [];

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: {
          list: [
            {
              pinId: 'pin_3',
              protocol: '/protocols/simplegroupchat',
              content: 'older-3',
              timestamp: 1711000003,
              index: 3,
              createGlobalMetaId: 'idq_other',
              chain: 'dogecoin',
            },
            {
              pinId: 'pin_5',
              protocol: '/protocols/simplegroupchat',
              content: 'updated-5',
              timestamp: 1711000005,
              index: 5,
              fromGlobalMetaId: 'idq_other',
              chain: 'btc',
            },
          ],
        },
      };
    },
  });

  const chatStore = {
    isLoading: false,
    error: null,
    messages: {
      [groupId]: [
        {
          id: 'pin_5',
          pinId: 'pin_5',
          protocol: '/protocols/simplegroupchat',
          content: 'old-5',
          timestamp: 1711000005,
          index: 5,
          fromGlobalMetaId: 'idq_other',
        },
        {
          id: 'pin_9',
          pinId: 'pin_9',
          protocol: '/protocols/simplegroupchat',
          content: 'old-9',
          timestamp: 1711000009,
          index: 9,
          fromGlobalMetaId: 'idq_other',
        },
      ],
    },
  };

  globalThis.window = {
    ServiceLocator: {
      idchat: 'https://api.idchat.io/chat-api/group-chat',
    },
    IDFramework: {
      dispatch: async (name, payload) => {
        dispatchCalls.push({ name, payload });
      },
    },
  };

  try {
    const rows = await command.execute({
      payload: { groupId, startIndex: 0, size: 20, mergeMode: 'prepend' },
      stores: {
        chat: chatStore,
        user: { users: {} },
      },
    });

    assert.equal(chatStore.isLoading, false);
    assert.equal(chatStore.error, null);
    assert.deepEqual(rows.map((row) => Number(row.index || 0)), [3, 5, 9]);
    assert.equal(rows[0].chain, 'doge');
    assert.equal(rows[1].content, 'updated-5');
    assert.ok(dispatchCalls.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('FetchGroupMessagesCommand replace mode sorts rows by index ascending', async () => {
  const command = new FetchGroupMessagesCommand();
  const groupId = 'group_sort_case';
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        data: {
          list: [
            { pinId: 'pin_12', protocol: '/protocols/simplegroupchat', content: '12', timestamp: 1711000012, index: 12 },
            { pinId: 'pin_10', protocol: '/protocols/simplegroupchat', content: '10', timestamp: 1711000010, index: 10 },
            { pinId: 'pin_11', protocol: '/protocols/simplegroupchat', content: '11', timestamp: 1711000011, index: 11 },
          ],
        },
      };
    },
  });

  const chatStore = {
    isLoading: false,
    error: null,
    messages: {},
  };

  globalThis.window = {
    ServiceLocator: {
      idchat: 'https://api.idchat.io/chat-api/group-chat',
    },
    IDFramework: {
      dispatch: async () => {},
    },
  };

  try {
    const rows = await command.execute({
      payload: { groupId, startIndex: 10, size: 20 },
      stores: {
        chat: chatStore,
        user: { users: {} },
      },
    });

    assert.deepEqual(rows.map((row) => Number(row.index || 0)), [10, 11, 12]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
