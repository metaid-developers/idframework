import test from 'node:test';
import assert from 'node:assert/strict';

import FetchUserCommand from '../idframework/commands/FetchUserCommand.js';

test('FetchUserCommand does not overwrite current user or open profile modal when fetching other users', async () => {
  const command = new FetchUserCommand();

  const userStore = {
    user: {
      globalMetaId: 'self_global',
      metaid: 'self_metaid',
      address: 'self_address',
      name: 'SunnyFung',
    },
    users: {},
    showProfileEditModal: false,
    isLoading: false,
    error: null,
  };

  await command.execute({
    payload: {
      globalMetaId: 'peer_global',
    },
    stores: {
      wallet: {
        globalMetaId: 'self_global',
        metaid: 'self_metaid',
        address: 'self_address',
      },
      user: userStore,
    },
    userDelegate: async () => ({
      globalMetaId: 'peer_global',
      metaid: 'peer_metaid',
      address: 'peer_address',
      name: '',
    }),
  });

  assert.equal(userStore.user.globalMetaId, 'self_global');
  assert.equal(userStore.user.name, 'SunnyFung');
  assert.equal(userStore.showProfileEditModal, false);
  assert.ok(userStore.users.peer_global);
});

test('FetchUserCommand opens profile modal for self when self profile has no name', async () => {
  const command = new FetchUserCommand();

  const userStore = {
    user: {},
    users: {},
    showProfileEditModal: false,
    isLoading: false,
    error: null,
  };

  await command.execute({
    payload: {
      globalMetaId: 'self_global',
    },
    stores: {
      wallet: {
        globalMetaId: 'self_global',
        metaid: 'self_metaid',
        address: 'self_address',
      },
      user: userStore,
    },
    userDelegate: async () => ({
      globalMetaId: 'self_global',
      metaid: 'self_metaid',
      address: 'self_address',
      name: '',
    }),
  });

  assert.equal(userStore.user.globalMetaId, 'self_global');
  assert.equal(userStore.showProfileEditModal, true);
});
