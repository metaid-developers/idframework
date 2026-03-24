import test from 'node:test';
import assert from 'node:assert/strict';

import PostBuzzCommand from '../idframework/commands/PostBuzzCommand.js';

test('PostBuzzCommand falls back to createPin upload on uploader LOCK_WRITE failure', async () => {
  const command = new PostBuzzCommand();
  const file = new File(['img'], 'demo.png', { type: 'image/png' });
  let fallbackCalls = 0;
  const originalWindow = globalThis.window;

  globalThis.window = {
    metaidwallet: {
      async createPin() {
        return { txids: ['x'] };
      },
    },
  };

  command._ensureOnchainReady = function () {};
  command.uploadFileToChainDirect = async function () {
    throw new Error('failed to save upload record: Error 1290 (HY000): The MySQL server is running with the LOCK_WRITE option');
  };
  command._uploadFileByCreatePin = async function (pickedFile) {
    fallbackCalls += 1;
    assert.equal(pickedFile.name, 'demo.png');
    return 'metafile://fallbacktxi0.png';
  };

  try {
    const result = await command._uploadFileToMetafile(file, {});
    assert.equal(result, 'metafile://fallbacktxi0.png');
    assert.equal(fallbackCalls, 1);
  } finally {
    globalThis.window = originalWindow;
  }
});

test('PostBuzzCommand createPin fallback uses base64 payload and preserves extension suffix', async () => {
  const command = new PostBuzzCommand();
  const originalWindow = globalThis.window;
  let capturedParams = null;

  globalThis.window = {
    metaidwallet: {
      async createPin(params) {
        capturedParams = params;
        return { txids: ['tx123'] };
      },
    },
  };

  command._ensureOnchainReady = function () {};
  command._fileToBase64 = async function () {
    return 'BASE64_PAYLOAD';
  };
  command._getFeeRate = function () {
    return 2;
  };

  try {
    const file = new File(['img'], 'Photo.JPG', { type: 'image/jpeg' });
    const uri = await command._uploadFileByCreatePin(file, {});
    assert.equal(uri, 'metafile://tx123i0.jpg');

    assert.ok(capturedParams);
    assert.equal(capturedParams.chain, 'mvc');
    assert.equal(capturedParams.feeRate, 2);
    assert.equal(Array.isArray(capturedParams.dataList), true);
    assert.equal(capturedParams.dataList.length, 1);

    const metaidData = capturedParams.dataList[0].metaidData || {};
    assert.equal(metaidData.operation, 'create');
    assert.equal(metaidData.path, '/file/Photo.JPG');
    assert.equal(metaidData.encoding, 'base64');
    assert.equal(metaidData.body, 'BASE64_PAYLOAD');
    assert.equal(metaidData.contentType, 'image/jpeg;binary');
  } finally {
    globalThis.window = originalWindow;
  }
});
