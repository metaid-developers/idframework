import PostBuzzCommand from './PostBuzzCommand.js';

export default class UploadNoteAttachmentCommand extends PostBuzzCommand {
  constructor(options = {}) {
    super();
    this._injectedUploader = options && options.uploader ? options.uploader : null;
  }

  async execute({ payload = {}, stores }) {
    var file = payload && payload.file;
    var options = payload && payload.options && typeof payload.options === 'object'
      ? payload.options
      : {};
    if (this._injectedUploader && typeof this._injectedUploader.uploadFileToMetafile === 'function') {
      return await this._injectedUploader.uploadFileToMetafile(file, stores, options);
    }
    return await this._uploadFileToMetafile(file, stores, options);
  }
}
