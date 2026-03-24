import test from 'node:test';
import assert from 'node:assert/strict';

import SelectConversationCommand from '../idframework/commands/SelectConversationCommand.js';

if (!globalThis.document) {
  globalThis.document = {
    getElementById() {
      return null;
    },
  };
}

test('SelectConversationCommand dispatches fetchPrivateMessages with recent-window startIndex', async () => {
  const command = new SelectConversationCommand();

  const chatStore = {
    conversations: {},
    messages: {},
    currentConversation: null,
    currentConversationId: null,
    currentConversationType: null,
    currentConversationIndex: null,
  };

  const calls = [];
  globalThis.window = {
    IDFramework: {
      dispatch: async (eventName, payload) => {
        calls.push({ eventName, payload });
      },
    },
  };

  await command.execute({
    payload: {
      metaid: 'peer_global_metaid',
      type: '2',
      index: 120,
    },
    stores: {
      wallet: { globalMetaId: 'self_global_metaid' },
      chat: chatStore,
      user: { users: {} },
    },
  });

  assert.equal(chatStore.currentConversation, 'peer_global_metaid');
  assert.equal(chatStore.currentConversationType, '2');

  const privateFetchCall = calls.find((item) => item.eventName === 'fetchPrivateMessages');
  assert.ok(privateFetchCall, 'expected fetchPrivateMessages to be dispatched');
  assert.equal(privateFetchCall.payload.otherMetaId, 'peer_global_metaid');
  assert.equal(privateFetchCall.payload.metaId, 'self_global_metaid');
  assert.equal(privateFetchCall.payload.startIndex, 71);
  assert.equal(privateFetchCall.payload.size, 50);
});

test('SelectConversationCommand preserves existing group index when payload index is zero', async () => {
  const command = new SelectConversationCommand();
  const groupId = 'group_preserve_idx';

  const chatStore = {
    conversations: {
      [groupId]: {
        metaid: groupId,
        groupId,
        type: '1',
        index: 3878,
      },
    },
    messages: {
      [groupId]: [],
    },
    currentConversation: null,
    currentConversationId: null,
    currentConversationType: null,
    currentConversationIndex: null,
  };

  const calls = [];
  globalThis.window = {
    IDFramework: {
      dispatch: async (eventName, payload) => {
        calls.push({ eventName, payload });
      },
    },
  };

  await command.execute({
    payload: {
      metaid: groupId,
      groupId,
      type: '1',
      index: 0,
    },
    stores: {
      chat: chatStore,
      wallet: { globalMetaId: 'self_global_metaid' },
      user: { users: {} },
    },
  });

  const groupFetchCall = calls.find((item) => item.eventName === 'fetchGroupMessages');
  assert.ok(groupFetchCall, 'expected fetchGroupMessages to be dispatched');
  assert.equal(groupFetchCall.payload.groupId, groupId);
  assert.equal(groupFetchCall.payload.startIndex, 3829);
  assert.equal(groupFetchCall.payload.size, 50);
  assert.equal(chatStore.currentConversationIndex, 3878);
  assert.equal(chatStore.conversations[groupId].index, 3878);
});

test('SelectConversationCommand falls back to local message max index when selecting group with missing index', async () => {
  const command = new SelectConversationCommand();
  const groupId = 'group_local_max_idx';

  const chatStore = {
    conversations: {
      [groupId]: {
        metaid: groupId,
        groupId,
        type: '1',
        index: 0,
      },
    },
    messages: {
      [groupId]: [
        { index: 3812 },
        { index: 3902 },
        { index: 3899 },
      ],
    },
    currentConversation: null,
    currentConversationId: null,
    currentConversationType: null,
    currentConversationIndex: null,
  };

  const calls = [];
  globalThis.window = {
    IDFramework: {
      dispatch: async (eventName, payload) => {
        calls.push({ eventName, payload });
      },
    },
  };

  await command.execute({
    payload: {
      metaid: groupId,
      groupId,
      type: '1',
      index: 0,
    },
    stores: {
      chat: chatStore,
      wallet: { globalMetaId: 'self_global_metaid' },
      user: { users: {} },
    },
  });

  const groupFetchCall = calls.find((item) => item.eventName === 'fetchGroupMessages');
  assert.ok(groupFetchCall, 'expected fetchGroupMessages to be dispatched');
  assert.equal(groupFetchCall.payload.groupId, groupId);
  assert.equal(groupFetchCall.payload.startIndex, 3853);
  assert.equal(groupFetchCall.payload.size, 50);
  assert.equal(chatStore.currentConversationIndex, 3902);
  assert.equal(chatStore.conversations[groupId].index, 3902);
});
