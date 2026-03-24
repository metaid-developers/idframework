import test from 'node:test';
import assert from 'node:assert/strict';

import FetchChatGroupMembersCommand from '../idframework/commands/FetchChatGroupMembersCommand.js';

const PIN_ID = '27a12fce2c09b0b55f715c9c56181c5bf7f7306fa2701e032da3a5cc01f6c489i0';

test('FetchChatGroupMembersCommand fetches member list with pagination metadata', async () => {
  const command = new FetchChatGroupMembersCommand();
  const chatStore = { groupMembersById: {} };
  const dispatched = [];

  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = {
      ServiceLocator: {
        idchat: 'https://api.idchat.io/chat-api/group-chat',
        metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
      },
      IDFramework: {
        dispatch: (...args) => {
          dispatched.push(args);
          return Promise.resolve();
        },
      },
    };

    globalThis.fetch = async (url) => {
      assert.match(String(url), /\/group-member-list\?/);
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            total: 3,
            creator: {
              globalMetaId: 'idq_creator',
              userInfo: { name: 'Owner' },
            },
            admins: [{ globalMetaId: 'idq_admin', userInfo: { name: 'Admin' } }],
            whiteList: [],
            blockList: [],
            list: [
              {
                globalMetaId: 'idq_member_1',
                metaId: 'meta_member_1',
                userInfo: {
                  name: 'Alice',
                  avatar: `/content/${PIN_ID}`,
                },
                timestamp: 1,
              },
              {
                globalMetaId: 'idq_member_2',
                metaId: 'meta_member_2',
                userInfo: {
                  name: 'Bob',
                  avatarImage: `metafile://${PIN_ID}`,
                },
                timestamp: 2,
              },
            ],
          },
        }),
      };
    };

    const result = await command.execute({
      payload: {
        groupId: 'group_1',
        cursor: 0,
        size: 2,
        append: false,
      },
      stores: { chat: chatStore },
    });

    assert.equal(result.list.length, 2);
    assert.equal(result.total, 3);
    assert.equal(result.cursor, 2);
    assert.equal(result.hasMore, true);
    assert.equal(result.creator.globalMetaId, 'idq_creator');
    assert.equal(result.admins.length, 1);
    assert.ok(result.list[0].avatar.includes(`/users/avatar/accelerate/${PIN_ID}?process=thumbnail`));
    assert.ok(dispatched.length >= 2);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test('FetchChatGroupMembersCommand search mode replaces list and turns off pagination', async () => {
  const command = new FetchChatGroupMembersCommand();
  const chatStore = {
    groupMembersById: {
      group_2: {
        list: [{ globalMetaId: 'old_member', name: 'Old' }],
        total: 1,
        cursor: 1,
        hasMore: true,
        mode: 'list',
      },
    },
  };

  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = {
      ServiceLocator: {
        idchat: 'https://api.idchat.io/chat-api/group-chat',
        metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
      },
      IDFramework: {
        dispatch: () => Promise.resolve(),
      },
    };

    globalThis.fetch = async (url) => {
      assert.match(String(url), /\/search-group-members\?/);
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            list: [
              {
                globalMetaId: 'idq_search_1',
                userInfo: { name: 'Search User' },
                timestamp: 3,
              },
            ],
          },
        }),
      };
    };

    const result = await command.execute({
      payload: {
        groupId: 'group_2',
        query: 'search user',
        size: 10,
        append: false,
      },
      stores: { chat: chatStore },
    });

    assert.equal(result.mode, 'search');
    assert.equal(result.query, 'search user');
    assert.equal(result.list.length, 1);
    assert.equal(result.list[0].name, 'Search User');
    assert.equal(result.hasMore, false);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});
