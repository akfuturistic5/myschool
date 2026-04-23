const { getStorageProvider } = require('../storage');

/**
 * Safely delete a file from storage if it exists.
 * @param {string} path - The relative path or URL of the file to delete.
 */
async function deleteFileIfExist(path) {
  if (!path || typeof path !== 'string') return;

  try {
    const provider = getStorageProvider();
    
    // If it's a full URL like /api/storage/files/school_1/documents/file.pdf
    // we need to extract the relative path: school_1/documents/file.pdf
    let relativePath = path;
    if (path.startsWith('/api/storage/files/')) {
      relativePath = path.replace('/api/storage/files/', '');
    } else if (path.startsWith('http')) {
      // If it's an absolute URL, try to extract the part after /storage/files/
      const match = path.match(/\/storage\/files\/(.+)$/);
      if (match) {
        relativePath = match[1];
      } else {
        // If it doesn't match our pattern, it might be an external URL
        return;
      }
    }

    // Decode URL encoded characters (like %20 for space)
    relativePath = decodeURIComponent(relativePath);

    await provider.delete(relativePath);
  } catch (error) {
    // We don't want to break the main flow if file deletion fails (e.g. file already gone)
    console.warn(`Failed to delete file: ${path}`, error.message);
  }
}

module.exports = {
  deleteFileIfExist,
};
