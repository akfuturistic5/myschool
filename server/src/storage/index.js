const { LocalFilesystemStorageProvider } = require('./LocalFilesystemStorageProvider');

let singleton = null;

/**
 * Future: STORAGE_DRIVER=s3 → return S3 provider.
 */
function getStorageProvider() {
  if (!singleton) {
    singleton = new LocalFilesystemStorageProvider();
  }
  return singleton;
}

module.exports = {
  getStorageProvider,
  LocalFilesystemStorageProvider,
};
