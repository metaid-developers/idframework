import test from 'node:test';
import assert from 'node:assert/strict';

import FetchProfileHeaderCommand from '../idframework/commands/FetchProfileHeaderCommand.js';
import FollowUserCommand from '../idframework/commands/FollowUserCommand.js';
import UnfollowUserCommand from '../idframework/commands/UnfollowUserCommand.js';

function createStore(metaid) {
  return {
    wallet: {
      isConnected: true,
      address: '1abc',
      globalMetaId: metaid || '',
    },
    user: {
      user: {
        metaid: metaid || '',
        address: '1abc',
      },
    },
  };
}

test('FetchProfileHeaderCommand normalizes profile/follow stats and relation', async () => {
  const command = new FetchProfileHeaderCommand();

  const calls = [];
  const delegate = async (_service, endpoint) => {
    calls.push(endpoint);
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
          bio: 'bio text',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 7, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 12, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      return {
        code: 1,
        data: {
          status: true,
          followPinId: 'f'.repeat(64) + 'i0',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores: createStore('d'.repeat(64)),
    delegate,
  });

  assert.equal(result.metaid, 'target_metaid');
  assert.equal(result.name, 'Alice');
  assert.equal(result.address, '1target');
  assert.equal(result.followingTotal, 7);
  assert.equal(result.followerTotal, 12);
  assert.equal(result.isFollowing, true);
  assert.equal(result.followPinId, 'f'.repeat(64) + 'i0');
  assert.ok(calls.some((item) => item.startsWith('/api/follow/record')));
});

test('FetchProfileHeaderCommand skips follow relation lookup when viewer has only globalMetaId', async () => {
  const command = new FetchProfileHeaderCommand();
  const calls = [];

  const delegate = async (_service, endpoint) => {
    calls.push(endpoint);
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 3, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 9, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      throw new Error('follow relation endpoint should not be called with globalMetaId');
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const stores = {
    wallet: {
      isConnected: true,
      address: '1abc',
      globalMetaId: 'idq1not_onchain_metaid',
      metaid: '',
    },
    user: {
      user: {
        metaid: '',
        metaId: '',
        address: '1abc',
      },
    },
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores,
    delegate,
  });

  assert.equal(result.isFollowing, false);
  assert.equal(result.followPinId, '');
  assert.equal(calls.some((item) => item.startsWith('/api/follow/record')), false);
});

test('FetchProfileHeaderCommand resolves viewer metaid by address when only globalMetaId exists', async () => {
  const command = new FetchProfileHeaderCommand();
  const calls = [];
  const expectedViewerMetaid = 'e'.repeat(64);

  const delegate = async (_service, endpoint) => {
    calls.push(endpoint);
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 8, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 15, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      if (endpoint.indexOf('followerMetaId=' + expectedViewerMetaid) < 0) {
        throw new Error('follow relation must use viewer metaid resolved by address');
      }
      return {
        code: 1,
        data: {
          status: true,
          followPinId: 'f'.repeat(64) + 'i0',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const userDelegate = async (_service, endpoint) => {
    if (endpoint.startsWith('/users/address/')) {
      return {
        code: 0,
        data: {
          metaId: expectedViewerMetaid,
          address: '1viewer',
          name: 'Viewer',
        },
      };
    }
    throw new Error('unexpected userDelegate endpoint: ' + endpoint);
  };

  const stores = {
    wallet: {
      isConnected: true,
      address: '1viewer',
      globalMetaId: 'idq1globalonly',
      metaid: '',
    },
    user: {
      user: {
        metaid: '',
        metaId: '',
        address: '1viewer',
      },
    },
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores,
    delegate,
    userDelegate,
  });

  assert.equal(result.viewerMetaid, expectedViewerMetaid);
  assert.equal(result.isFollowing, true);
  assert.equal(result.followPinId, 'f'.repeat(64) + 'i0');
  assert.equal(calls.some((item) => item.startsWith('/api/follow/record')), true);
});

test('FetchProfileHeaderCommand tries viewer metaids from globalMetaIdInfo when relation lookup', async () => {
  const command = new FetchProfileHeaderCommand();
  const calls = [];
  const viewerFromGlobalInfo = 'a'.repeat(64);

  const delegate = async (_service, endpoint) => {
    calls.push(endpoint);
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 1, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 2, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      if (endpoint.indexOf('followerMetaId=' + viewerFromGlobalInfo) >= 0) {
        return {
          code: 1,
          data: {
            status: true,
            followPinId: 'f'.repeat(64) + 'i0',
          },
        };
      }
      return {
        code: 1,
        data: {
          status: false,
          followPinId: '',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const stores = {
    wallet: {
      isConnected: true,
      address: '1viewer',
      globalMetaId: 'idq1globalonly',
      metaid: '',
      globalMetaIdInfo: {
        mvc: {
          globalMetaId: 'idq1globalonly',
          metaId: viewerFromGlobalInfo,
        },
      },
    },
    user: {
      user: {
        metaid: '',
        metaId: '',
        address: '1viewer',
      },
    },
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores,
    delegate,
  });

  assert.equal(result.viewerMetaid, viewerFromGlobalInfo);
  assert.equal(result.isFollowing, true);
  assert.equal(result.followPinId, 'f'.repeat(64) + 'i0');
  assert.equal(
    calls.some((item) => item.startsWith('/api/follow/record') && item.indexOf('followerMetaId=' + viewerFromGlobalInfo) >= 0),
    true
  );
});

test('FetchProfileHeaderCommand prefers viewer metaid resolved by address over stale store metaid', async () => {
  const command = new FetchProfileHeaderCommand();
  const expectedViewerMetaid = 'e'.repeat(64);
  const staleViewerMetaid = 'd'.repeat(64);
  const calls = [];

  const delegate = async (_service, endpoint) => {
    calls.push(endpoint);
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 1, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 2, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      if (endpoint.indexOf('followerMetaId=' + expectedViewerMetaid) >= 0) {
        return {
          code: 1,
          data: {
            status: true,
            followPinId: 'f'.repeat(64) + 'i0',
          },
        };
      }
      return {
        code: 1,
        data: {
          status: false,
          followPinId: '',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const userDelegate = async (_service, endpoint) => {
    if (endpoint.startsWith('/users/address/')) {
      return {
        code: 0,
        data: {
          metaId: expectedViewerMetaid,
          address: '1viewer',
          name: 'Viewer',
        },
      };
    }
    throw new Error('unexpected userDelegate endpoint: ' + endpoint);
  };

  const stores = {
    wallet: {
      isConnected: true,
      address: '1viewer',
      globalMetaId: 'idq1globalonly',
      metaid: '',
    },
    user: {
      user: {
        metaid: staleViewerMetaid,
        metaId: '',
        address: '1viewer',
      },
    },
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores,
    delegate,
    userDelegate,
  });

  assert.equal(result.viewerMetaid, expectedViewerMetaid);
  assert.equal(result.isFollowing, true);
  assert.equal(
    calls.some((item) => item.startsWith('/api/follow/record') && item.indexOf('followerMetaId=' + expectedViewerMetaid) >= 0),
    true
  );
});

test('FetchProfileHeaderCommand respects explicit followerMetaid before address-resolved fallback', async () => {
  const command = new FetchProfileHeaderCommand();
  const explicitViewerMetaid = '9'.repeat(64);
  const byAddressViewerMetaid = '8'.repeat(64);
  const followCalls = [];

  const delegate = async (_service, endpoint) => {
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 1, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 2, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      followCalls.push(endpoint);
      if (endpoint.indexOf('followerMetaId=' + explicitViewerMetaid) >= 0) {
        return {
          code: 1,
          data: {
            status: true,
            followPinId: 'f'.repeat(64) + 'i0',
          },
        };
      }
      return {
        code: 1,
        data: {
          status: false,
          followPinId: '',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const userDelegate = async (_service, endpoint) => {
    if (endpoint.startsWith('/users/address/')) {
      return {
        code: 0,
        data: {
          metaId: byAddressViewerMetaid,
          address: '1viewer',
        },
      };
    }
    throw new Error('unexpected userDelegate endpoint: ' + endpoint);
  };

  const stores = {
    wallet: {
      isConnected: true,
      address: '1viewer',
      globalMetaId: 'idq1globalonly',
      metaid: '',
    },
    user: {
      user: {
        metaid: '',
        metaId: '',
        address: '1viewer',
      },
    },
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid', followerMetaid: explicitViewerMetaid },
    stores,
    delegate,
    userDelegate,
  });

  assert.equal(result.viewerMetaid, explicitViewerMetaid);
  assert.equal(result.isFollowing, true);
  assert.equal(followCalls.length > 0, true);
  assert.equal(followCalls[0].indexOf('followerMetaId=' + explicitViewerMetaid) >= 0, true);
});

test('FetchProfileHeaderCommand treats status=true as following even when followPinId is temporarily empty', async () => {
  const command = new FetchProfileHeaderCommand();
  const expectedViewerMetaid = 'e'.repeat(64);

  const delegate = async (_service, endpoint) => {
    if (endpoint.startsWith('/api/info/metaid/')) {
      return {
        code: 1,
        data: {
          metaid: 'target_metaid',
          name: 'Alice',
          address: '1target',
          avatar: '/content/avatar_pinid',
        },
      };
    }
    if (endpoint.startsWith('/api/metaid/followingList/')) {
      return { code: 1, data: { total: 1, list: [] } };
    }
    if (endpoint.startsWith('/api/metaid/followerList/')) {
      return { code: 1, data: { total: 2, list: [] } };
    }
    if (endpoint.startsWith('/api/follow/record')) {
      return {
        code: 1,
        data: {
          status: true,
          followPinId: '',
        },
      };
    }
    throw new Error('unexpected endpoint: ' + endpoint);
  };

  const stores = {
    wallet: {
      isConnected: true,
      address: '1viewer',
      globalMetaId: 'idq1globalonly',
      metaid: expectedViewerMetaid,
    },
    user: {
      user: {
        metaid: expectedViewerMetaid,
        metaId: '',
        address: '1viewer',
      },
    },
  };

  const result = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores,
    delegate,
  });

  assert.equal(result.viewerMetaid, expectedViewerMetaid);
  assert.equal(result.isFollowing, true);
  assert.equal(result.followPinId, '');
});

test('FollowUserCommand creates follow pin with /follow path', async () => {
  let createPinPayload = null;
  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async ({ payload }) => {
          createPinPayload = payload;
          return { txid: 'a'.repeat(64) };
        },
      },
    },
    metaidwallet: {},
  };

  const command = new FollowUserCommand();
  const res = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores: createStore('viewer_metaid'),
  });

  assert.equal(createPinPayload.operation, 'create');
  assert.equal(createPinPayload.path, '/follow');
  assert.equal(createPinPayload.contentType, 'text/plain;utf-8');
  assert.equal(createPinPayload.body, 'target_metaid');
  assert.equal(res.pinId, 'a'.repeat(64) + 'i0');
});

test('FollowUserCommand returns follower metaid from mvc globalMetaIdInfo when available', async () => {
  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async () => ({ txid: 'a'.repeat(64) }),
      },
    },
    metaidwallet: {},
  };

  const followerMetaid = 'e'.repeat(64);
  const command = new FollowUserCommand();
  const res = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores: {
      wallet: {
        isConnected: true,
        address: '1viewer',
        globalMetaIdInfo: {
          mvc: {
            metaId: followerMetaid,
          },
        },
      },
      user: {
        user: {
          metaid: '',
          address: '1viewer',
        },
      },
    },
  });

  assert.equal(res.followerMetaid, followerMetaid);
});

test('FollowUserCommand throws when wallet response is explicitly canceled', async () => {
  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async () => ({ status: 'canceled' }),
      },
    },
    metaidwallet: {},
  };

  const command = new FollowUserCommand();
  await assert.rejects(
    command.execute({
      payload: { metaid: 'target_metaid' },
      stores: createStore('viewer_metaid'),
    }),
    /canceled or failed/
  );
});

test('FollowUserCommand extracts txid from txids array', async () => {
  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async () => ({ txids: ['a'.repeat(64)] }),
      },
    },
    metaidwallet: {},
  };

  const command = new FollowUserCommand();
  const res = await command.execute({
    payload: { metaid: 'target_metaid' },
    stores: createStore('viewer_metaid'),
  });

  assert.equal(res.txid, 'a'.repeat(64));
  assert.equal(res.pinId, 'a'.repeat(64) + 'i0');
});

test('UnfollowUserCommand resolves follower metaid from globalMetaIdInfo when followPinId is missing', async () => {
  let createPinPayload = null;
  const expectedFollowPinId = 'd'.repeat(64) + 'i0';
  const viewerFromGlobalInfo = 'a'.repeat(64);
  const targetMetaid = 'b'.repeat(64);

  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async ({ payload }) => {
          createPinPayload = payload;
          return { txid: 'e'.repeat(64) };
        },
      },
    },
    metaidwallet: {},
  };

  const command = new UnfollowUserCommand();
  await command.execute({
    payload: { metaid: targetMetaid },
    stores: {
      wallet: {
        isConnected: true,
        address: '1viewer',
        globalMetaId: 'idq1globalonly',
        metaid: '',
        globalMetaIdInfo: {
          mvc: {
            metaId: viewerFromGlobalInfo,
          },
        },
      },
      user: {
        user: {
          metaid: '',
          metaId: '',
          address: '1viewer',
        },
      },
    },
    delegate: async (_service, endpoint) => {
      if (!endpoint.startsWith('/api/follow/record')) return { code: 1, data: {} };
      if (endpoint.indexOf('metaId=' + targetMetaid) < 0) return { code: 1, data: {} };
      if (endpoint.indexOf('followerMetaId=' + viewerFromGlobalInfo) < 0) return { code: 1, data: {} };
      return {
        code: 1,
        data: {
          status: true,
          followPinId: expectedFollowPinId,
        },
      };
    },
  });

  assert.equal(createPinPayload.operation, 'revoke');
  assert.equal(createPinPayload.path, '@' + expectedFollowPinId);
  assert.equal(createPinPayload.contentType, 'text/plain;utf-8');
});

test('UnfollowUserCommand creates revoke pin with @followPinId', async () => {
  let createPinPayload = null;
  globalThis.window = {
    IDFramework: {
      BuiltInCommands: {
        createPin: async ({ payload }) => {
          createPinPayload = payload;
          return { txid: 'b'.repeat(64) };
        },
      },
    },
    metaidwallet: {},
  };

  const followPinId = 'c'.repeat(64) + 'i0';
  const command = new UnfollowUserCommand();
  await command.execute({
    payload: { metaid: 'target_metaid', followPinId },
    stores: createStore('viewer_metaid'),
    delegate: async () => ({ code: 1, data: {} }),
  });

  assert.equal(createPinPayload.operation, 'revoke');
  assert.equal(createPinPayload.path, '@' + followPinId);
  assert.equal(createPinPayload.contentType, 'text/plain;utf-8');
});
