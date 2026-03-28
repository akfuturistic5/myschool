const fs = require('fs');

/**
 * Magic-byte check for PNG / JPEG / WEBP (first chunk of file).
 */
function isAllowedRasterImageMagic(buf) {
  if (!buf || buf.length < 12) return false;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  // WEBP: RIFF .... WEBP
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return true;
  }
  return false;
}

function validateImageFileAtPath(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    return isAllowedRasterImageMagic(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  isAllowedRasterImageMagic,
  validateImageFileAtPath,
};
