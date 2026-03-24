import test from 'node:test';
import assert from 'node:assert/strict';

import FetchFollowRelationCommand from '../idframework/commands/FetchFollowRelationCommand.js';

test('FetchFollowRelationCommand resolves status/followPinId via metaid_man', async () => {
  const command = new FetchFollowRelationCommand();
  const targetMetaid = 'a'.repeat(64);
  const viewerMetaid = 'b'.repeat(64);
  const followPinId = 'c'.repeat(64) + 'i0';

  const calls = [];
  const delegate = async (service, endpoint) => {
    calls.push({ service, endpoint });
    if (service !== 'metaid_man') throw new Error('unexpected service');
    return {
      code: 1,
      data: {
        status: true,
        followPinId: followPinId,
      },
    };
  };

  const result = await command.execute({
    payload: {
      metaid: targetMetaid,
      viewerMetaid: viewerMetaid,
    },
    delegate,
  });

  assert.equal(result.targetMetaid, targetMetaid);
  assert.equal(result.viewerMetaid, viewerMetaid);
  assert.equal(result.isFollowing, true);
  assert.equal(result.followPinId, followPinId);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endpoint.startsWith('/api/follow/record?'));
});

test('FetchFollowRelationCommand falls back to man_api when metaid_man fails', async () => {
  const command = new FetchFollowRelationCommand();
  const targetMetaid = 'd'.repeat(64);
  const viewerMetaid = 'e'.repeat(64);

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
          status: false,
          followPinId: '',
        },
      };
    }
    throw new Error('unexpected service');
  };

  const result = await command.execute({
    payload: {
      metaid: targetMetaid,
      viewerMetaid: viewerMetaid,
    },
    delegate,
  });

  assert.equal(result.isFollowing, false);
  assert.equal(result.followPinId, '');
  assert.equal(calls.length, 2);
  assert.ok(calls[0].endpoint.startsWith('/api/follow/record?'));
  assert.ok(calls[1].endpoint.startsWith('/follow/record?'));
});

test('FetchFollowRelationCommand resolves viewer metaid from address when store has only global id', async () => {
  const command = new FetchFollowRelationCommand();
  const targetMetaid = 'f'.repeat(64);
  const viewerMetaid = '1'.repeat(64);
  const calls = [];

  const stores = {
    wallet: {
      address: '1viewer',
      globalMetaId: 'idq1globalmetaid',
      metaid: '',
    },
    user: {
      user: {
        address: '1viewer',
        metaid: '',
      },
    },
  };

  const userDelegate = async (_service, endpoint) => {
    if (endpoint.indexOf('/users/address/1viewer') >= 0) {
      return {
        code: 0,
        data: {
          metaId: viewerMetaid,
          address: '1viewer',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const delegate = async (_service, endpoint) => {
    calls.push(endpoint);
    return {
      code: 1,
      data: {
        status: true,
        followPinId: '2'.repeat(64) + 'i0',
      },
    };
  };

  const result = await command.execute({
    payload: {
      metaid: targetMetaid,
    },
    stores,
    delegate,
    userDelegate,
  });

  assert.equal(result.viewerMetaid, viewerMetaid);
  assert.equal(result.isFollowing, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].indexOf('followerMetaId=' + viewerMetaid) >= 0);
});
