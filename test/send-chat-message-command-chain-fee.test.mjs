import test from 'node:test';
import assert from 'node:assert/strict';

import SendChatMessageCommand from '../idframework/commands/SendChatMessageCommand.js';

function createBaseWindow(options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const wallet = {
    createPin: typeof opts.createPin === 'function'
      ? opts.createPin
      : async function () {
          return { txids: ['tx-default'] };
        },
  };
  if (typeof opts.btcInscribe === 'function' || typeof opts.btcGetAddress === 'function') {
    wallet.btc = {
      inscribe: opts.btcInscribe,
      getAddress: opts.btcGetAddress || (async function () { return 'btc-address'; }),
    };
  }
  if (typeof opts.dogeInscribe === 'function' || typeof opts.dogeGetAddress === 'function') {
    wallet.doge = {
      inscribe: opts.dogeInscribe,
      getAddress: opts.dogeGetAddress || (async function () { return 'doge-address'; }),
    };
  }
  return {
    metaidwallet: wallet,
  };
}

test('SendChatMessageCommand uses explicit payload chain and feeRate', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  let capturedParams = null;

  globalThis.window = createBaseWindow({
    createPin: async function (params) {
      capturedParams = params;
      return { txids: ['tx-explicit'] };
    },
  });
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_1',
        content: 'hello',
        chain: 'doge',
        feeRate: 1234567,
      },
      stores: {},
    });

    assert.ok(capturedParams, 'createPin should be called');
    assert.equal(capturedParams.chain, 'doge');
    assert.equal(capturedParams.feeRate, 1234567);
    assert.equal(result.chain, 'doge');
    assert.equal(result.feeRate, 1234567);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand falls back to chainFee Alpine store', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  let capturedParams = null;

  const chainFeeStore = {
    currentChain: 'btc',
    getSelectedFeeRate(chain) {
      if (chain === 'btc') return 7;
      return 1;
    },
  };

  globalThis.window = createBaseWindow({
    createPin: async function (params) {
      capturedParams = params;
      return { txids: ['tx-store'] };
    },
  });
  globalThis.Alpine = {
    store(name) {
      if (name === 'chainFee') return chainFeeStore;
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_2',
        content: 'hello from store',
      },
      stores: {},
    });

    assert.ok(capturedParams, 'createPin should be called');
    assert.equal(capturedParams.chain, 'btc');
    assert.equal(capturedParams.feeRate, 7);
    assert.equal(result.chain, 'btc');
    assert.equal(result.feeRate, 7);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand prefers doge inscribe when available', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  let createPinCalled = false;
  let capturedInscribeParams = null;
  const expectedDogeTxid = 'd'.repeat(64);

  globalThis.window = createBaseWindow({
    createPin: async function () {
      createPinCalled = true;
      return { txids: ['tx-create-pin-fallback'] };
    },
    dogeGetAddress: async function () {
      return 'D-test-address';
    },
    dogeInscribe: async function (params) {
      capturedInscribeParams = params;
      return [expectedDogeTxid];
    },
  });
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_doge',
        content: 'hello inscribe',
        chain: 'doge',
        feeRate: 234567,
      },
      stores: {},
    });

    assert.equal(createPinCalled, false, 'createPin should not be called when doge inscribe is available');
    assert.ok(capturedInscribeParams, 'doge.inscribe should be called');
    assert.equal(capturedInscribeParams.data.changeAddress, 'D-test-address');
    assert.equal(capturedInscribeParams.data.feeRate, 234567);
    assert.equal(result.txid, expectedDogeTxid);
    assert.equal(result.chain, 'doge');
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand normalizes btc feeRate=1 to 1.1 for inscribe', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  let capturedInscribeParams = null;
  const expectedBtcTxid = 'b'.repeat(64);

  globalThis.window = createBaseWindow({
    btcGetAddress: async function () {
      return 'bc1-test-address';
    },
    btcInscribe: async function (params) {
      capturedInscribeParams = params;
      return [expectedBtcTxid];
    },
  });
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_btc',
        content: 'hello btc',
        chain: 'btc',
        feeRate: 1,
      },
      stores: {},
    });

    assert.ok(capturedInscribeParams, 'btc.inscribe should be called');
    assert.equal(capturedInscribeParams.data.feeRate, 1.1);
    assert.equal(result.txid, expectedBtcTxid);
    assert.equal(result.chain, 'btc');
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand extracts btc txid from revealTxIds object list', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  let createPinCalled = false;

  const expectedTxid = 'a'.repeat(64);
  globalThis.window = createBaseWindow({
    createPin: async function () {
      createPinCalled = true;
      return { txids: ['fallback-should-not-run'] };
    },
    btcGetAddress: async function () {
      return 'bc1-test-address';
    },
    btcInscribe: async function () {
      return { revealTxIds: [{ txid: expectedTxid }] };
    },
  });
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_btc_reveal_list',
        content: 'hello btc reveal list',
        chain: 'btc',
        feeRate: 2,
      },
      stores: {},
    });

    assert.equal(createPinCalled, false, 'createPin should not be called when inscribe succeeds');
    assert.equal(result.txid, expectedTxid);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand falls back to createPin when doge inscribe reports insufficient funds', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  let createPinCalled = false;
  let capturedCreatePinParams = null;
  const fallbackTxid = 'c'.repeat(64);

  globalThis.window = createBaseWindow({
    createPin: async function (params) {
      createPinCalled = true;
      capturedCreatePinParams = params;
      return { txids: [fallbackTxid] };
    },
    dogeGetAddress: async function () {
      return 'D-test-address';
    },
    dogeInscribe: async function () {
      throw new Error('Insufficient funds: need 1000000, have 1000000');
    },
  });
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_doge_insufficient',
        content: 'hello doge fallback',
        chain: 'doge',
        feeRate: 200000,
      },
      stores: {},
    });

    assert.equal(createPinCalled, true, 'createPin fallback should be triggered');
    assert.equal(capturedCreatePinParams.chain, 'doge');
    assert.equal(capturedCreatePinParams.feeRate, 200000);
    assert.equal(result.txid, fallbackTxid);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand group file uses /file base64 pin on btc before simplefilegroupchat', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  const calls = [];
  const fileTxid = '1'.repeat(64);
  const msgTxid = '2'.repeat(64);

  globalThis.window = createBaseWindow();
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._createWithWallet = async function (metaidData, feeRate, estimate, chain) {
    calls.push({ metaidData, feeRate, estimate, chain });
    if (metaidData.path === '/file') return { txids: [fileTxid] };
    return { txids: [msgTxid] };
  };

  try {
    const imageFile = new File(['demo-image-content'], 'photo.png', { type: 'image/png' });
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_file_btc',
        file: imageFile,
        chain: 'btc',
        feeRate: 3,
      },
      stores: {},
    });

    assert.equal(calls.length, 2, 'file pin + message pin should be created');
    assert.equal(calls[0].metaidData.path, '/file');
    assert.equal(calls[0].metaidData.encoding, 'base64');
    assert.equal(calls[0].metaidData.contentType, 'image/png;binary');
    assert.equal(typeof calls[0].metaidData.body, 'string');

    assert.equal(calls[1].metaidData.path, '/protocols/simplefilegroupchat');
    assert.equal(result.filePinTxid, fileTxid);
    assert.equal(result.txid, msgTxid);
    assert.equal(result.attachment, `metafile://${fileTxid}i0.png`);
    assert.equal(result.body.attachment, `metafile://${fileTxid}i0.png`);
    assert.equal(result.body.fileType, 'png');
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand group file prefers mvc binary pin and falls back to base64', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  const calls = [];
  const fileTxid = '3'.repeat(64);
  const msgTxid = '4'.repeat(64);

  globalThis.window = createBaseWindow();
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._createWithWallet = async function (metaidData, feeRate, estimate, chain) {
    calls.push({ metaidData, feeRate, estimate, chain });
    if (metaidData.path === '/file' && metaidData.encoding === 'binary') {
      throw new Error('binary body is not supported in this wallet');
    }
    if (metaidData.path === '/file') return { txids: [fileTxid] };
    return { txids: [msgTxid] };
  };

  try {
    const imageFile = new File(['mvc-image-content'], 'group-avatar.jpg', { type: 'image/jpeg' });
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_file_mvc',
        file: imageFile,
        chain: 'mvc',
        feeRate: 1,
      },
      stores: {},
    });

    assert.equal(calls.length, 3, 'mvc should try binary then fallback base64 before message pin');
    assert.equal(calls[0].metaidData.path, '/file');
    assert.equal(calls[0].metaidData.encoding, 'binary');
    assert.ok(calls[0].metaidData.body instanceof Uint8Array);

    assert.equal(calls[1].metaidData.path, '/file');
    assert.equal(calls[1].metaidData.encoding, 'base64');
    assert.equal(typeof calls[1].metaidData.body, 'string');

    assert.equal(calls[2].metaidData.path, '/protocols/simplefilegroupchat');
    assert.equal(result.filePinTxid, fileTxid);
    assert.equal(result.txid, msgTxid);
    assert.equal(result.attachment, `metafile://${fileTxid}i0.jpg`);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
  }
});

test('SendChatMessageCommand uses MVC smallPay fast path when auto payment is approved', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  const originalFetch = globalThis.fetch;
  let createPinCalled = false;
  let smallPayCalled = false;
  let paymentStatusCalled = 0;
  let autoPaymentCalled = 0;
  const expectedTxid = 'e'.repeat(64);

  class FakeTxComposer {
    constructor() {
      this._serialized = 'serialized-tx-1';
      this._txid = expectedTxid;
      this._rawHex = '01020304';
    }

    appendP2PKHOutput() {}

    appendOpReturnOutput() {}

    serialize() {
      return this._serialized;
    }

    getTxId() {
      return this._txid;
    }

    getTx() {
      return { toString: () => this._rawHex };
    }

    static deserialize() {
      return new FakeTxComposer();
    }
  }

  globalThis.window = createBaseWindow({
    createPin: async function () {
      createPinCalled = true;
      return { txids: ['fallback-create-pin'] };
    },
  });
  globalThis.window.metaidwallet.getAddress = async function () {
    return '1-test-wallet-address';
  };
  globalThis.window.metaidwallet.getNetwork = async function () {
    return { network: 'mainnet' };
  };
  globalThis.window.metaidwallet.smallPay = async function () {
    smallPayCalled = true;
    return { payedTransactions: ['signed-composer-1'] };
  };
  globalThis.window.useApprovedStore = function () {
    return {
      canUse: true,
      last: { autoPaymentAmount: 10000 },
      async getPaymentStatus() {
        paymentStatusCalled += 1;
      },
      async getAutoPayment() {
        autoPaymentCalled += 1;
      },
    };
  };
  globalThis.window.MetaIDJs = {
    TxComposer: FakeTxComposer,
    mvc: {
      Address: class {
        constructor(value) {
          this.value = value;
        }
      },
      Script: {
        buildSafeDataOut(parts) {
          return parts;
        },
      },
      deps: { Buffer: Buffer },
    },
  };
  globalThis.fetch = async function () {
    return {
      ok: true,
      async json() {
        return { code: 0, data: expectedTxid };
      },
    };
  };
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_smallpay',
        content: 'hello smallpay',
        chain: 'mvc',
        feeRate: 1,
      },
      stores: {},
    });

    assert.equal(smallPayCalled, true, 'smallPay should be used for mvc when approved');
    assert.equal(createPinCalled, false, 'createPin should be skipped when mvc smallPay succeeds');
    assert.ok(paymentStatusCalled >= 1, 'payment status should be queried');
    assert.ok(autoPaymentCalled >= 1, 'auto payment should be queried');
    assert.equal(result.txid, expectedTxid);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
    globalThis.fetch = originalFetch;
  }
});

test('SendChatMessageCommand still attempts MVC smallPay when approved store is stale', async () => {
  const command = new SendChatMessageCommand();
  const originalWindow = globalThis.window;
  const originalAlpine = globalThis.Alpine;
  const originalFetch = globalThis.fetch;
  let createPinCalled = false;
  let smallPayCalled = false;
  const expectedTxid = 'f'.repeat(64);

  class FakeTxComposer {
    constructor() {
      this._serialized = 'serialized-tx-stale';
      this._txid = expectedTxid;
      this._rawHex = '0a0b0c';
    }

    appendP2PKHOutput() {}

    appendOpReturnOutput() {}

    serialize() {
      return this._serialized;
    }

    getTxId() {
      return this._txid;
    }

    getTx() {
      return { toString: () => this._rawHex };
    }

    static deserialize() {
      return new FakeTxComposer();
    }
  }

  globalThis.window = createBaseWindow({
    createPin: async function () {
      createPinCalled = true;
      return { txids: ['fallback-create-pin'] };
    },
  });
  globalThis.window.metaidwallet.getAddress = async function () {
    return '1-test-wallet-address';
  };
  globalThis.window.metaidwallet.getNetwork = async function () {
    return { network: 'mainnet' };
  };
  globalThis.window.metaidwallet.smallPay = async function () {
    smallPayCalled = true;
    return { payedTransactions: ['signed-composer-stale'] };
  };
  globalThis.window.useApprovedStore = function () {
    return {
      canUse: false,
      last: { autoPaymentAmount: 10000 },
      async getPaymentStatus() {
        return { isEnabled: true, isApproved: true, autoPaymentAmount: 10000 };
      },
      async getAutoPayment() {
        return { message: 'Auto payment approved' };
      },
    };
  };
  globalThis.window.MetaIDJs = {
    TxComposer: FakeTxComposer,
    mvc: {
      Address: class {
        constructor(value) {
          this.value = value;
        }
      },
      Script: {
        buildSafeDataOut(parts) {
          return parts;
        },
      },
      deps: { Buffer: Buffer },
    },
  };
  globalThis.fetch = async function () {
    return {
      ok: true,
      async json() {
        return { code: 0, data: expectedTxid };
      },
    };
  };
  globalThis.Alpine = {
    store() {
      return null;
    },
  };

  command._ensureOnchainReady = function () {};
  command._groupEncrypt = function () {
    return 'encrypted-text';
  };

  try {
    const result = await command.execute({
      payload: {
        mode: 'group',
        groupId: 'group_smallpay_stale',
        content: 'hello smallpay stale',
        chain: 'mvc',
        feeRate: 1,
      },
      stores: {},
    });

    assert.equal(smallPayCalled, true, 'smallPay should still be attempted when store state is stale');
    assert.equal(createPinCalled, false, 'createPin should be skipped when smallPay succeeds');
    assert.equal(result.txid, expectedTxid);
  } finally {
    globalThis.window = originalWindow;
    globalThis.Alpine = originalAlpine;
    globalThis.fetch = originalFetch;
  }
});
