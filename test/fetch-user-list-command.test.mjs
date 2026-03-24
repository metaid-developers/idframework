import test from 'node:test';
import assert from 'node:assert/strict';

import FetchUserListCommand from '../idframework/commands/FetchUserListCommand.js';

test('FetchUserListCommand fetches following list and enriches user profile by address', async () => {
  const command = new FetchUserListCommand();
  const targetMetaid = 'target_metaid';
  const firstMetaid = 'a'.repeat(64);
  const secondMetaid = 'b'.repeat(64);

  const calls = [];
  const delegate = async (service, endpoint) => {
    calls.push({ service, endpoint });
    if (service !== 'metaid_man') throw new Error('unexpected service');
    return {
      code: 1,
      data: {
        total: 3,
        list: [
          { metaid: firstMetaid, address: '1alice' },
          { metaid: secondMetaid, address: '1bob', name: 'Bob', avatar: 'https://avatar.example/bob.png' },
        ],
      },
    };
  };

  const userDelegate = async (_service, endpoint) => {
    if (endpoint.indexOf('/users/address/1alice') >= 0) {
      return {
        code: 0,
        data: {
          metaId: firstMetaid,
          name: 'Alice',
          avatarUrl: 'https://avatar.example/alice.png',
          address: '1alice',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const result = await command.execute({
    payload: {
      metaid: targetMetaid,
      type: 'following',
      cursor: 0,
      size: 10,
    },
    delegate,
    userDelegate,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].service, 'metaid_man');
  assert.ok(calls[0].endpoint.startsWith('/api/metaid/followingList/' + encodeURIComponent(targetMetaid)));
  assert.equal(result.type, 'following');
  assert.equal(result.list.length, 2);
  assert.equal(result.list[0].name, 'Alice');
  assert.equal(result.list[0].avatar, 'https://avatar.example/alice.png');
  assert.equal(result.list[1].name, 'Bob');
  assert.equal(result.hasMore, true);
  assert.equal(result.nextCursor, '2');
});

test('FetchUserListCommand falls back to man_api endpoint for followers list', async () => {
  const command = new FetchUserListCommand();
  const calls = [];

  const delegate = async (service, endpoint) => {
    calls.push({ service, endpoint });
    if (service === 'metaid_man') {
      throw new Error('metaid_man unavailable');
    }
    if (service === 'man_api') {
      return {
        code: 1,
        data: {
          total: 1,
          list: [{ metaid: 'c'.repeat(64), address: '1charlie', name: 'Charlie' }],
        },
      };
    }
    throw new Error('unexpected service: ' + service);
  };

  const result = await command.execute({
    payload: {
      metaid: 'target_metaid',
      type: 'followers',
      cursor: 0,
      size: 10,
    },
    delegate,
  });

  assert.equal(calls.length, 2);
  assert.ok(calls[0].endpoint.startsWith('/api/metaid/followerList/'));
  assert.ok(calls[1].endpoint.startsWith('/metaid/followerList/'));
  assert.equal(result.type, 'followers');
  assert.equal(result.list.length, 1);
  assert.equal(result.list[0].name, 'Charlie');
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, '');
});

test('FetchUserListCommand computes hasMore=false when returned rows are less than page size and total is absent', async () => {
  const command = new FetchUserListCommand();

  const delegate = async () => ({
    code: 1,
    data: {
      list: [{ metaid: 'd'.repeat(64), address: '1d' }],
    },
  });

  const result = await command.execute({
    payload: {
      metaid: 'target_metaid',
      type: 'following',
      cursor: 0,
      size: 10,
    },
    delegate,
  });

  assert.equal(result.list.length, 1);
  assert.equal(result.total, 1);
  assert.equal(result.hasMore, false);
  assert.equal(result.nextCursor, '');
});
