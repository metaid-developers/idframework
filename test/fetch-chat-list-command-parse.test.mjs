import test from 'node:test';
import assert from 'node:assert/strict';

import FetchChatListCommand from '../idframework/commands/FetchChatListCommand.js';

if (!globalThis.IDFramework) {
  globalThis.IDFramework = {
    dispatch: () => Promise.resolve(),
  };
}

test('FetchChatListCommand keeps plain-text content as lastMessage preview', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 1,
          groupId: 'group_1',
          roomName: 'Group One',
          content: 'hello world',
          timestamp: 1711000000000,
          index: 11,
        },
      ],
    },
  });

  assert.ok(conversations.group_1);
  assert.equal(conversations.group_1.lastMessage, 'hello world');
  assert.equal(conversations.group_1.type, '1');
});

test('FetchChatListCommand prefixes group preview with sender label in a single line', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 1,
          groupId: 'group_sender_preview',
          roomName: 'Group Sender',
          content: 'line one\nline two',
          senderName: 'Alice',
          timestamp: 1711000000000,
          index: 13,
        },
      ],
    },
  });

  assert.ok(conversations.group_sender_preview);
  assert.equal(conversations.group_sender_preview.lastMessage, 'Alice: line one line two');
});

test('FetchChatListCommand maps private chat by metaId and preserves user name', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 2,
          metaId: 'peer_metaid',
          userInfo: {
            name: 'Alice',
            avatarImage: 'https://example.com/a.png',
          },
          content: 'hi',
          timestamp: 1711000000000,
          index: 5,
        },
      ],
    },
  });

  assert.ok(conversations.peer_metaid);
  assert.equal(conversations.peer_metaid.name, 'Alice');
  assert.equal(conversations.peer_metaid.type, '2');
});

test('FetchChatListCommand maps private chat by userInfo.globalMetaId when metaId is missing', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 2,
          userInfo: {
            globalMetaId: 'peer_global_metaid',
            name: 'Bob',
            avatarImage: 'https://example.com/b.png',
          },
          content: 'hello',
          timestamp: 1711000000000,
          index: 9,
        },
      ],
    },
  });

  assert.ok(conversations.peer_global_metaid);
  assert.equal(conversations.peer_global_metaid.name, 'Bob');
  assert.equal(conversations.peer_global_metaid.type, '2');
});

test('FetchChatListCommand strips sender label prefix from private preview text', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 2,
          metaId: 'peer_prefixed_private',
          userInfo: {
            name: 'Alice',
            avatarImage: 'https://example.com/a.png',
          },
          senderName: 'Alice',
          content: 'Alice: hello there',
          timestamp: 1711000000000,
          index: 15,
        },
      ],
    },
  });

  assert.ok(conversations.peer_prefixed_private);
  assert.equal(conversations.peer_prefixed_private.lastMessage, 'hello there');
});

test('FetchChatListCommand does not expose encrypted placeholder before runtime decryption', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 1,
          groupId: 'group_enc_hex',
          roomName: 'Encrypted Hex',
          content: 'a'.repeat(128),
          senderName: 'Bob',
          timestamp: 1711000000000,
          index: 3,
        },
        {
          type: 1,
          groupId: 'group_enc_b64',
          roomName: 'Encrypted B64',
          content: 'U2FsdGVkX1+6Qx4C3QmKjVnQ9pXyJ5M2w9W7hYvYx5m4X0uY8R3Y4xQ2P7mK8Qx3',
          senderName: 'Carol',
          timestamp: 1711000001000,
          index: 4,
        },
      ],
    },
  });

  assert.equal(conversations.group_enc_hex.lastMessage, null);
  assert.equal(conversations.group_enc_b64.lastMessage, null);
});

test('FetchChatListCommand normalizes invalid conversation index to 0', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 1,
          groupId: 'group_invalid_index',
          roomName: 'Group',
          content: 'hello',
          timestamp: 1711000000000,
          index: -1,
        },
      ],
    },
  });

  assert.equal(conversations.group_invalid_index.index, 0);
});

test('FetchChatListCommand resolves conversation index from roomNewestIndex fallback', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 1,
          groupId: 'group_room_newest_index',
          roomName: 'Group',
          content: 'hello',
          timestamp: 1711000000000,
          index: 0,
          roomNewestIndex: 1453,
        },
      ],
    },
  });

  assert.equal(conversations.group_room_newest_index.index, 1453);
});

test('FetchChatListCommand resolves conversation index from lastMessage.index fallback', () => {
  const command = new FetchChatListCommand();

  const conversations = command._parseChatList({
    data: {
      list: [
        {
          type: 2,
          globalMetaId: 'peer_fallback_index',
          userInfo: {
            globalMetaId: 'peer_fallback_index',
            name: 'Peer',
          },
          content: 'hello',
          timestamp: 1711000000000,
          index: 0,
          lastMessage: {
            index: 920,
            content: 'hello',
          },
        },
      ],
    },
  });

  assert.equal(conversations.peer_fallback_index.index, 920);
});

test('FetchChatListCommand resolves preview sender by sender identity instead of conversation title fallback', () => {
  const command = new FetchChatListCommand();
  const row = {
    createGlobalMetaId: 'idq_sender_abc123',
    createMetaId: 'meta_sender',
    userInfo: {
      globalMetaId: 'idq_peer_xyz789',
      metaid: 'meta_peer',
      name: 'PeerName',
    },
    createUserInfo: null,
  };

  const sender = command._resolveSenderLabel(
    row,
    { name: 'Room Name' },
    { globalMetaId: 'idq_viewer_001' },
    {
      users: {
        idq_sender_abc123: { name: 'SenderName' },
      },
    }
  );

  assert.equal(sender, 'SenderName');
});

test('FetchChatListCommand runtime preview prefixes group content with sender label', async () => {
  const command = new FetchChatListCommand();

  const preview = await command._resolveRuntimePreviewForConversation(
    {
      type: '1',
      groupId: 'group_runtime_sender',
      _raw: {
        content: 'hello runtime',
        createGlobalMetaId: 'idq_sender_runtime',
        createUserInfo: {
          globalMetaId: 'idq_sender_runtime',
          name: 'Alice',
        },
      },
    },
    { globalMetaId: 'idq_viewer_runtime' },
    { users: {} }
  );

  assert.equal(preview, 'Alice: hello runtime');
});

test('FetchChatListCommand runtime preview strips sender label from private content', async () => {
  const command = new FetchChatListCommand();

  const preview = await command._resolveRuntimePreviewForConversation(
    {
      type: '2',
      metaid: 'peer_runtime_sender',
      _raw: {
        content: 'Alice: hello runtime',
        createGlobalMetaId: 'peer_runtime_sender',
        userInfo: {
          globalMetaId: 'peer_runtime_sender',
          name: 'Alice',
        },
      },
    },
    { globalMetaId: 'self_runtime_viewer' },
    { users: {} }
  );

  assert.equal(preview, 'hello runtime');
});

test('FetchChatListCommand maps private avatar to avatar accelerate endpoint', () => {
  const command = new FetchChatListCommand();
  const pinId = '202b11bc5f7e3832639001883464777577ef1450c9b16abc63d255d229f05b7ai0';
  const previousWindow = globalThis.window;
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: {
      metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
    },
  };

  try {
    const conversations = command._parseChatList({
      data: {
        list: [
          {
            type: 2,
            globalMetaId: 'peer_global_metaid',
            userInfo: {
              globalMetaId: 'peer_global_metaid',
              name: 'Bob',
              avatarImage: `/content/${pinId}`,
            },
            content: 'hello',
            timestamp: 1711000000000,
            index: 9,
          },
        ],
      },
    });

    assert.equal(
      conversations.peer_global_metaid.avatar,
      `https://file.metaid.io/metafile-indexer/api/v1/users/avatar/accelerate/${pinId}?process=thumbnail`
    );
  } finally {
    globalThis.window = previousWindow;
  }
});

test('FetchChatListCommand maps group roomIcon to files accelerate thumbnail endpoint', () => {
  const command = new FetchChatListCommand();
  const pinId = 'e2f5608fa630c32b00ddf6f26f4e8728aad7ce019f8f55bf3a3a6cc17d37f4d3i0';
  const previousWindow = globalThis.window;
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: {
      metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
    },
  };

  try {
    const conversations = command._parseChatList({
      data: {
        list: [
          {
            type: 1,
            groupId: 'group_room_icon',
            roomName: 'Room Icon Group',
            roomIcon: `metafile://${pinId}`,
            content: 'hello',
            timestamp: 1711000000000,
            index: 1,
          },
        ],
      },
    });

    assert.equal(
      conversations.group_room_icon.avatar,
      `https://file.metaid.io/metafile-indexer/api/v1/files/accelerate/content/${pinId}?process=thumbnail`
    );
  } finally {
    globalThis.window = previousWindow;
  }
});

test('FetchChatListCommand convertMetafileUrl uses files/content endpoint in content mode', () => {
  const command = new FetchChatListCommand();
  const pinId = 'e2f5608fa630c32b00ddf6f26f4e8728aad7ce019f8f55bf3a3a6cc17d37f4d3i0';
  const previousWindow = globalThis.window;
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: {
      metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
    },
  };

  try {
    const converted = command._convertMetafileUrl(`metafile://${pinId}`, 'content');
    assert.equal(
      converted,
      `https://file.metaid.io/metafile-indexer/api/v1/files/content/${pinId}`
    );
  } finally {
    globalThis.window = previousWindow;
  }
});

test('FetchChatListCommand convertMetafileUrl returns empty string for empty pin id', () => {
  const command = new FetchChatListCommand();
  const previousWindow = globalThis.window;
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: {
      metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
    },
  };

  try {
    const converted = command._convertMetafileUrl('metafile://', 'content');
    assert.equal(converted, '');
  } finally {
    globalThis.window = previousWindow;
  }
});
