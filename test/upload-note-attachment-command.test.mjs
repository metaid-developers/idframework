import test from 'node:test';
import assert from 'node:assert/strict';

import UploadNoteAttachmentCommand from '../idframework/commands/UploadNoteAttachmentCommand.js';
import MetafileUploadHelper from '../idframework/utils/metafile-upload.js';

function createMockFileReader() {
  return class MockFileReader {
    readAsDataURL() {
      this.result = 'data:text/plain;base64,TU9DSw==';
      if (typeof this.onload === 'function') this.onload();
    }
  };
}

test('MetafileUpload helper returns metafile URI with preserved extension', async () => {
  const helper = new MetafileUploadHelper({
    ensureOnchainReady() {},
    uploadFileToChainDirect: async function () {
      return { txId: 'tx123' };
    },
    runChunkedUploadFlow: async function () {
      return { txId: 'chunktx' };
    },
  });

  const file = new File(['img'], 'Photo.JPG', { type: 'image/jpeg' });
  const uri = await helper.uploadFileToMetafile(file, {}, { chain: 'mvc' });

  assert.equal(uri, 'metafile://tx123i0.jpg');
});

test('UploadNoteAttachmentCommand default path uses direct upload for small files', async () => {
  const command = new UploadNoteAttachmentCommand();
  const file = new File(['img'], 'small.PNG', { type: 'image/png' });
  const originalWindow = globalThis.window;
  const originalFileReader = globalThis.FileReader;
  let directCalls = 0;
  let chunkedCalls = 0;
  let fallbackCalls = 0;

  globalThis.FileReader = createMockFileReader();
  globalThis.window = {
    metaidwallet: {
      async createPin() {
        fallbackCalls += 1;
        return { txids: ['fallbacktx'] };
      },
    },
  };

  command._ensureOnchainReady = function () {};
  command.uploadFileToChainDirect = async function (pickedFile) {
    directCalls += 1;
    assert.equal(pickedFile.name, 'small.PNG');
    return { txId: 'directtx' };
  };
  command.runChunkedUploadFlow = async function () {
    chunkedCalls += 1;
    return { txId: 'chunktx' };
  };

  try {
    const uri = await command.execute({
      payload: { file, options: { chain: 'mvc' } },
      stores: {},
    });

    assert.equal(uri, 'metafile://directtxi0.png');
    assert.equal(directCalls, 1);
    assert.equal(chunkedCalls, 0);
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.window = originalWindow;
    globalThis.FileReader = originalFileReader;
  }
});

test('UploadNoteAttachmentCommand default path uses chunked upload for large files', async () => {
  const command = new UploadNoteAttachmentCommand();
  const file = new File([new Uint8Array(6 * 1024 * 1024)], 'large.mp4', { type: 'video/mp4' });
  const originalWindow = globalThis.window;
  const originalFileReader = globalThis.FileReader;
  let directCalls = 0;
  let chunkedCalls = 0;
  let fallbackCalls = 0;

  globalThis.FileReader = createMockFileReader();
  globalThis.window = {
    metaidwallet: {
      async createPin() {
        fallbackCalls += 1;
        return { txids: ['fallbacktx'] };
      },
    },
  };

  command._ensureOnchainReady = function () {};
  command.uploadFileToChainDirect = async function () {
    directCalls += 1;
    return { txId: 'directtx' };
  };
  command.runChunkedUploadFlow = async function (options) {
    chunkedCalls += 1;
    assert.equal(options && options.asynchronous, false);
    return { txId: 'chunktx' };
  };

  try {
    const uri = await command.execute({
      payload: { file, options: { chain: 'mvc' } },
      stores: {},
    });

    assert.equal(uri, 'metafile://chunktxi0.mp4');
    assert.equal(chunkedCalls, 1);
    assert.equal(directCalls, 0);
    assert.equal(fallbackCalls, 0);
  } finally {
    globalThis.window = originalWindow;
    globalThis.FileReader = originalFileReader;
  }
});

test('UploadNoteAttachmentCommand delegates attachment upload to shared helper', async () => {
  const file = new File(['hello'], 'note.txt', { type: 'text/plain' });
  const stores = { wallet: { isConnected: true } };
  const options = { chain: 'mvc', feeRate: 3 };
  const calls = [];
  const uploader = {
    async uploadFileToMetafile(pickedFile, pickedStores, pickedOptions) {
      calls.push({ pickedFile, pickedStores, pickedOptions });
      return 'metafile://resulti0.txt';
    },
  };
  const command = new UploadNoteAttachmentCommand({ uploader });

  const result = await command.execute({
    payload: { file, options },
    stores,
  });

  assert.equal(result, 'metafile://resulti0.txt');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pickedFile, file);
  assert.equal(calls[0].pickedStores, stores);
  assert.deepEqual(calls[0].pickedOptions, options);
});
