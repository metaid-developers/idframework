import test from 'node:test';
import assert from 'node:assert/strict';

function createAlpineStore() {
  const stores = new Map();
  return {
    store(name, value) {
      if (arguments.length === 2) {
        stores.set(name, value);
        return value;
      }
      return stores.get(name);
    },
  };
}

async function loadFramework(caseId) {
  await import(`../idframework/idframework.js?case=${caseId}`);
  if (globalThis.window && !globalThis.window.IDFramework && globalThis.IDFramework) {
    globalThis.window.IDFramework = globalThis.IDFramework;
  }
  return (globalThis.window && globalThis.window.IDFramework) || globalThis.IDFramework;
}

function installWindow(alpine) {
  const current = globalThis.window || {};
  globalThis.window = current;
  globalThis.window.Alpine = alpine;
  globalThis.window.ServiceLocator = {
    metafs: 'https://file.metaid.io/metafile-indexer/api/v1',
  };
  if (typeof globalThis.window.addEventListener !== 'function') {
    globalThis.window.addEventListener = () => {};
  }
}

test('UserDelegate avoids duplicated /v1 in URL when base already ends with /v1', { concurrency: false }, async () => {
  const alpine = createAlpineStore();
  const capturedUrls = [];

  globalThis.fetch = async (url) => {
    capturedUrls.push(String(url));
    return {
      ok: true,
      async json() {
        return {
          code: 1,
          data: {
            globalMetaId: 'idq1sample',
            metaId: 'a'.repeat(64),
            address: '1abc',
            name: 'Alice',
            avatar: '',
          },
        };
      },
    };
  };

  installWindow(alpine);
  const framework = await loadFramework('user-delegate-v1-dedup');

  await framework.Delegate.UserDelegate(
    'metafs',
    '/v1/info/globalmetaid/idq1sample',
    { globalMetaId: 'idq1sample' }
  );

  assert.equal(
    capturedUrls[0],
    'https://file.metaid.io/metafile-indexer/api/v1/info/globalmetaid/idq1sample'
  );
});

test('UserDelegate normalizes metafile-indexer /content avatar URL into users/avatar/accelerate thumbnail endpoint', { concurrency: false }, async () => {
  const alpine = createAlpineStore();
  installWindow(alpine);
  const framework = await loadFramework('user-delegate-avatar-normalize-content-url');

  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      return {
        code: 1,
        data: {
          globalMetaId: 'idq1sample2',
          metaId: 'b'.repeat(64),
          name: 'Bob',
          avatar: 'https://file.metaid.io/metafile-indexer/content/abcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcba1234i0',
        },
      };
    },
  });

  const user = await framework.Delegate.UserDelegate(
    'metafs',
    '/info/globalmetaid/idq1sample2',
    { globalMetaId: 'idq1sample2' }
  );

  assert.equal(
    user.avatarUrl,
    'https://file.metaid.io/metafile-indexer/api/v1/users/avatar/accelerate/abcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcba1234i0?process=thumbnail'
  );
});

test('UserDelegate falls back to /users/address avatar when globalmetaid payload avatar is non-usable', { concurrency: false }, async () => {
  const alpine = createAlpineStore();
  installWindow(alpine);
  const framework = await loadFramework('user-delegate-avatar-address-fallback');

  const capturedUrls = [];
  globalThis.fetch = async (url) => {
    const target = String(url);
    capturedUrls.push(target);

    if (target.includes('/info/globalmetaid/')) {
      return {
        ok: true,
        async json() {
          return {
            code: 1,
            data: {
              globalMetaId: 'idq1sample3',
              metaId: 'c'.repeat(64),
              address: '1abc',
              name: 'Carol',
              avatar: '/content/cccceffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcba4321i0',
              avatarId: 'cccceffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcba4321i0',
            },
          };
        },
      };
    }

    if (target.includes('/users/address/1abc')) {
      return {
        ok: true,
        async json() {
          return {
            code: 0,
            data: {
              globalMetaId: 'idq1sample3',
              metaId: 'c'.repeat(64),
              address: '1abc',
              name: 'Carol',
              avatar: 'https://metafs.oss-cn-beijing.aliyuncs.com/indexer/avatar/btc/sample/sample.png',
              avatarPinId: 'cccceffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcbaabcdeffedcba4321i0',
            },
          };
        },
      };
    }

    return {
      ok: false,
      status: 404,
      async json() {
        return {};
      },
    };
  };

  const user = await framework.Delegate.UserDelegate(
    'metafs',
    '/info/globalmetaid/idq1sample3',
    { globalMetaId: 'idq1sample3' }
  );

  assert.equal(user.avatarUrl, 'https://metafs.oss-cn-beijing.aliyuncs.com/indexer/avatar/btc/sample/sample.png');
  assert.ok(capturedUrls.some((url) => url.includes('/info/globalmetaid/idq1sample3')));
  assert.ok(capturedUrls.some((url) => url.includes('/users/address/1abc')));
});
