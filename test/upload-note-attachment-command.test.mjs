import test from 'node:test';
import assert from 'node:assert/strict';

import UploadNoteAttachmentCommand from '../idframework/commands/UploadNoteAttachmentCommand.js';
import MetafileUploadHelper from '../idframework/utils/metafile-upload.js';

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
