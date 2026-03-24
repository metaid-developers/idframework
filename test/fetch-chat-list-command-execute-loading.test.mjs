import test from 'node:test';
import assert from 'node:assert/strict';

import FetchChatListCommand from '../idframework/commands/FetchChatListCommand.js';

function createChatStore(initialConversations = { existing: { type: '1' } }) {
  const loadingWrites = [];
  const store = {
    _loading: false,
    conversations: initialConversations,
    error: null,
    get isLoading() {
      return this._loading;
    },
    set isLoading(value) {
      loadingWrites.push(!!value);
      this._loading = !!value;
    },
  };
  return { store, loadingWrites };
}

test('FetchChatListCommand background refresh keeps loading flag untouched when conversations already exist', async () => {
  const command = new FetchChatListCommand();
  command._parseChatList = () => ({
    existing: { type: '1', groupId: 'existing', lastMessageTime: Date.now() },
  });
  command._enrichConversationPreviews = async () => {};
  command._notifyChatUpdated = () => {};

  const { store: chatStore, loadingWrites } = createChatStore({ existing: { type: '1' } });
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: { background: true },
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }

  assert.equal(loadingWrites.includes(true), false);
});

test('FetchChatListCommand foreground refresh toggles loading flag', async () => {
  const command = new FetchChatListCommand();
  command._parseChatList = () => ({
    existing: { type: '1', groupId: 'existing', lastMessageTime: Date.now() },
  });
  command._enrichConversationPreviews = async () => {};
  command._notifyChatUpdated = () => {};

  const { store: chatStore, loadingWrites } = createChatStore({ existing: { type: '1' } });
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: {},
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }

  assert.equal(loadingWrites.includes(true), true);
  assert.equal(chatStore.isLoading, false);
});

test('FetchChatListCommand commits conversation list before async preview hydration finishes', async () => {
  const command = new FetchChatListCommand();
  command._parseChatList = () => ({
    conv_1: {
      type: '1',
      groupId: 'group_1',
      lastMessage: 'raw-preview',
      lastMessageTime: Date.now(),
    },
  });

  let resolveHydration;
  const hydrationGate = new Promise((resolve) => {
    resolveHydration = resolve;
  });
  command._enrichConversationPreviews = async (conversations) => {
    await hydrationGate;
    conversations.conv_1.lastMessage = 'hydrated-preview';
    return 1;
  };

  let notifyCount = 0;
  command._notifyChatUpdated = () => {
    notifyCount += 1;
  };

  const { store: chatStore } = createChatStore({ existing: { type: '1' } });
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: {},
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });
    assert.equal(chatStore.conversations.conv_1.lastMessage, 'raw-preview');
    assert.equal(notifyCount, 1);

    resolveHydration();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(chatStore.conversations.conv_1.lastMessage, 'hydrated-preview');
    assert.equal(notifyCount, 2);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }
});

test('FetchChatListCommand keeps previous positive conversation index when latest-chat-info omits index', async () => {
  const command = new FetchChatListCommand();
  command._parseChatList = () => ({
    group_keep_index: {
      type: '1',
      groupId: 'group_keep_index',
      index: 0,
      lastMessage: 'preview',
      lastMessageTime: Date.now(),
    },
  });
  command._enrichConversationPreviews = async () => {};
  command._notifyChatUpdated = () => {};

  const { store: chatStore } = createChatStore({
    group_keep_index: {
      type: '1',
      groupId: 'group_keep_index',
      index: 4123,
      lastMessageTime: Date.now(),
    },
  });
  chatStore.messages = {
    group_keep_index: [{ index: 4100 }, { index: 4123 }],
  };
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: {},
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }

  assert.equal(chatStore.conversations.group_keep_index.index, 4123);
});

test('FetchChatListCommand keeps local preview when API catches up to same index with stale group preview text', async () => {
  const command = new FetchChatListCommand();
  command._parseChatList = () => ({
    group_same_index_stale_preview: {
      type: '1',
      groupId: 'group_same_index_stale_preview',
      index: 88,
      lastMessage: 'older api preview',
      lastMessageTime: 1700000005000,
    },
  });
  command._enrichConversationPreviews = async () => {};
  command._notifyChatUpdated = () => {};

  const { store: chatStore } = createChatStore({
    group_same_index_stale_preview: {
      type: '1',
      groupId: 'group_same_index_stale_preview',
      index: 88,
      lastMessage: 'newest local preview',
      lastMessageTime: 1700000004000,
    },
  });
  chatStore.messages = {
    group_same_index_stale_preview: [{ index: 87 }, { index: 88 }],
  };
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: {},
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }

  assert.equal(chatStore.conversations.group_same_index_stale_preview.lastMessage, 'newest local preview');
  assert.equal(chatStore.conversations.group_same_index_stale_preview.lastMessageTime, 1700000005000);
});

test('FetchChatListCommand hydration does not revert preserved local preview to stale API text', async () => {
  const command = new FetchChatListCommand();
  command._parseChatList = () => ({
    group_stale_hydration_preview: {
      type: '1',
      groupId: 'group_stale_hydration_preview',
      index: 88,
      lastMessage: 'older api preview',
      lastMessageTime: 1700000005000,
      _raw: { type: '1', groupId: 'group_stale_hydration_preview', content: 'older api preview' },
    },
  });
  command._resolveRuntimePreviewForConversation = async () => 'older api preview';

  let notifyCount = 0;
  command._notifyChatUpdated = () => {
    notifyCount += 1;
  };

  const { store: chatStore } = createChatStore({
    group_stale_hydration_preview: {
      type: '1',
      groupId: 'group_stale_hydration_preview',
      index: 88,
      lastMessage: 'newest local preview',
      lastMessageTime: 1700000004000,
    },
  });
  chatStore.messages = {
    group_stale_hydration_preview: [{ index: 87 }, { index: 88 }],
  };
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: {},
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });

    assert.equal(chatStore.conversations.group_stale_hydration_preview.lastMessage, 'newest local preview');

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(chatStore.conversations.group_stale_hydration_preview.lastMessage, 'newest local preview');
    assert.equal(notifyCount, 1);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }
});

test('FetchChatListCommand hydrates previews in staged batches: eager 20 then lazy chunks', async () => {
  const command = new FetchChatListCommand();
  const baseTime = Date.now();
  command._parseChatList = () => {
    const conversations = {};
    for (let i = 0; i < 40; i += 1) {
      const key = `conv_${String(i).padStart(2, '0')}`;
      conversations[key] = {
        type: '1',
        groupId: `group_${i}`,
        lastMessage: '',
        lastMessageTime: baseTime - i,
      };
    }
    return conversations;
  };

  let resolveLazyBatch;
  const lazyBatchGate = new Promise((resolve) => {
    resolveLazyBatch = resolve;
  });
  const batchSizes = [];
  command._enrichConversationPreviews = async (conversations, walletStore, userStore, targetKeys) => {
    const keys = Array.isArray(targetKeys) ? targetKeys : [];
    batchSizes.push(keys.length);
    keys.forEach((key) => {
      conversations[key].lastMessage = `hydrated-${key}`;
    });
    if (batchSizes.length > 1) await lazyBatchGate;
    return keys.length;
  };

  let notifyCount = 0;
  command._notifyChatUpdated = () => {
    notifyCount += 1;
  };

  const { store: chatStore } = createChatStore({ existing: { type: '1' } });
  const walletStore = { isConnected: true, globalMetaId: 'self_global_metaid' };
  const userStore = { users: {} };

  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const previousIDFramework = globalThis.IDFramework;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { list: [] } }),
  });
  globalThis.window = {
    ...(globalThis.window || {}),
    ServiceLocator: { idchat: 'https://api.idchat.io/chat-api/group-chat' },
  };
  globalThis.IDFramework = { dispatch: () => Promise.resolve() };

  try {
    await command.execute({
      payload: {},
      stores: { wallet: walletStore, chat: chatStore, user: userStore },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(batchSizes[0], 20);
    assert.equal(notifyCount, 2);

    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(batchSizes[1], 20);
    assert.equal(notifyCount, 2);

    resolveLazyBatch();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(notifyCount, 3);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
    globalThis.IDFramework = previousIDFramework;
  }
});
