import test from 'node:test';
import assert from 'node:assert/strict';

import FetchBuzzCommand from '../idframework/commands/FetchBuzzCommand.js';

function getQuery(endpoint) {
  const parts = String(endpoint || '').split('?');
  return new URLSearchParams(parts[1] || '');
}

test('FetchBuzzCommand resolves following metaid by address when only global id is provided', async () => {
  const command = new FetchBuzzCommand();
  const resolvedMetaid = 'a'.repeat(64);
  const calls = [];

  const delegate = async (service, endpoint) => {
    calls.push({ service, endpoint });
    if (service === 'metafs') {
      assert.match(endpoint, /\/users\/address\//);
      return {
        code: 1,
        data: {
          metaId: resolvedMetaid,
          address: '1viewer',
        },
      };
    }
    if (service === 'metaid_man') {
      return {
        code: 1,
        data: {
          list: [],
          total: 0,
          lastId: '',
        },
      };
    }
    throw new Error('unexpected service: ' + service);
  };

  await command.execute({
    payload: {
      tab: 'following',
      size: 10,
      lastId: '',
      metaid: 'idq1global-only',
      userAddress: '1viewer',
    },
    stores: {
      wallet: {
        isConnected: true,
        address: '1viewer',
        globalMetaId: 'idq1global-only',
        metaid: '',
      },
      user: {
        user: {
          metaid: '',
          metaId: '',
          globalMetaId: 'idq1global-only',
          address: '1viewer',
        },
      },
    },
    delegate,
  });

  const metafsCallCount = calls.filter((item) => item.service === 'metafs').length;
  assert.equal(metafsCallCount, 1);

  const manCall = calls.find((item) => item.service === 'metaid_man');
  assert.ok(manCall, 'timeline endpoint call is required');
  const query = getQuery(manCall.endpoint);
  assert.equal(query.get('metaid'), resolvedMetaid);
  assert.equal(query.get('followed'), '1');
});

test('FetchBuzzCommand prefers explicit on-chain metaid for following feed', async () => {
  const command = new FetchBuzzCommand();
  const explicitMetaid = 'b'.repeat(64);
  const calls = [];

  const delegate = async (service, endpoint) => {
    calls.push({ service, endpoint });
    if (service === 'metaid_man') {
      return {
        code: 1,
        data: {
          list: [],
          total: 0,
          lastId: '',
        },
      };
    }
    throw new Error('unexpected service: ' + service);
  };

  await command.execute({
    payload: {
      tab: 'following',
      size: 10,
      lastId: '',
      metaid: explicitMetaid,
      userAddress: '1viewer',
    },
    stores: {
      wallet: {
        isConnected: true,
        address: '1viewer',
        globalMetaId: 'idq1global-only',
        metaid: '',
      },
      user: {
        user: {
          metaid: '',
          metaId: '',
          globalMetaId: 'idq1global-only',
          address: '1viewer',
        },
      },
    },
    delegate,
  });

  assert.equal(calls.some((item) => item.service === 'metafs'), false);

  const manCall = calls.find((item) => item.service === 'metaid_man');
  assert.ok(manCall, 'timeline endpoint call is required');
  const query = getQuery(manCall.endpoint);
  assert.equal(query.get('metaid'), explicitMetaid);
  assert.equal(query.get('followed'), '1');
});
