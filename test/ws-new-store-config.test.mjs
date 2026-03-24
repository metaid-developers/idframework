import test from 'node:test';
import assert from 'node:assert/strict';

test('ws-new resolves idchat socket url and /socket path prefix from ServiceLocator', async () => {
  globalThis.window = {
    ServiceLocator: {
      idchat: 'https://api.idchat.io/chat-api/group-chat',
      chat_ws: 'https://api.idchat.io',
      chat_ws_path: '/socket',
    },
  };

  const mod = await import('../idframework/stores/chat/ws-new.js?case=resolve-socket-config');
  const cfg = mod.resolveSocketConfig();

  assert.equal(cfg.url, 'https://api.idchat.io');
  assert.equal(cfg.pathPrefix, '/socket');
});

test('ws-new normalizes socket path by appending /socket.io under configured prefix', async () => {
  const mod = await import('../idframework/stores/chat/ws-new.js?case=resolve-socket-path');

  assert.equal(mod.resolveSocketPath('/socket'), '/socket/socket.io');
  assert.equal(mod.resolveSocketPath('/socket/'), '/socket/socket.io');
  assert.equal(mod.resolveSocketPath(''), '/socket.io');
});

test('ws-new normalizes wrapped message envelope from message event', async () => {
  const mod = await import('../idframework/stores/chat/ws-new.js?case=normalize-envelope-wrapped');
  const raw = JSON.stringify({
    M: 'WS_SERVER_NOTIFY_GROUP_CHAT',
    D: { groupId: 'group-1', content: 'hello' },
  });

  const normalized = mod.normalizeSocketEnvelope(raw);
  assert.deepEqual(normalized, {
    messageType: 'WS_SERVER_NOTIFY_GROUP_CHAT',
    payload: { groupId: 'group-1', content: 'hello' },
  });
});

test('ws-new normalizes named notify event and parses nested payload JSON string', async () => {
  const mod = await import('../idframework/stores/chat/ws-new.js?case=normalize-envelope-named');
  const normalized = mod.normalizeSocketEnvelope(
    '{"toGlobalMetaId":"peer-1","content":"hey"}',
    'WS_SERVER_NOTIFY_PRIVATE_CHAT'
  );

  assert.deepEqual(normalized, {
    messageType: 'WS_SERVER_NOTIFY_PRIVATE_CHAT',
    payload: { toGlobalMetaId: 'peer-1', content: 'hey' },
  });
});

test('ws-new store forwards parsed socket payload to onMessage callback', async () => {
  const mod = await import('../idframework/stores/chat/ws-new.js?case=handle-envelope-forward');
  const store = new mod.WsNewStore();
  let receivedPayload = null;
  let noticeCount = 0;

  store.onMessage = (payload) => {
    receivedPayload = payload;
  };
  store.playNotice = () => {
    noticeCount += 1;
  };

  store._handleReceivedMessage(
    '{"M":"WS_SERVER_NOTIFY_PRIVATE_CHAT","D":"{\\"fromGlobalMetaId\\":\\"sender\\",\\"content\\":\\"ping\\"}"}'
  );

  assert.deepEqual(receivedPayload, { fromGlobalMetaId: 'sender', content: 'ping' });
  assert.equal(noticeCount, 1);
});
