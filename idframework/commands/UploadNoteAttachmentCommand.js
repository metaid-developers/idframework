import MetafileUploadHelper from '../utils/metafile-upload.js';

export default class UploadNoteAttachmentCommand {
  constructor(options = {}) {
    this._uploader = options && options.uploader ? options.uploader : new MetafileUploadHelper();
  }

  async execute({ payload = {}, stores }) {
    var file = payload && payload.file;
    var options = payload && payload.options && typeof payload.options === 'object'
      ? payload.options
      : {};
    return await this._uploader.uploadFileToMetafile(file, stores, options);
  }
}
