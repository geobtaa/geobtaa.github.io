export const IMAGE_DIRECTORY = 'src/assets/images';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TYPES = Object.freeze({
  'image/png': { extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/jpeg': { extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  'image/gif': { extension: 'gif', ascii: 'GIF8' },
  'image/webp': { extension: 'webp', ascii: 'RIFF', secondary: { offset: 8, ascii: 'WEBP' } },
});

export function validateImagePath(value) {
  const decoded = decodeURIComponent(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:png|jpe?g|gif|webp)$/i.test(decoded) || decoded.includes('..') || decoded.includes('//')) {
    throw Object.assign(new Error('Invalid image path.'), { status: 400 });
  }
  return decoded;
}

export function sanitizeImageFilename(value, mimeType) {
  const type = TYPES[mimeType];
  if (!type) throw Object.assign(new Error('Upload a PNG, JPEG, GIF, or WebP image.'), { status: 400 });
  const originalBase = String(value || '').replace(/\\/g, '/').split('/').at(-1)?.replace(/\.[^.]*$/, '') || 'image';
  const base = originalBase.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'image';
  return `${base}.${type.extension}`;
}

function hasAscii(bytes, offset, value) {
  return [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export function validateImageUpload({ filename, mimeType, bytes }) {
  const type = TYPES[mimeType];
  if (!type) throw Object.assign(new Error('Upload a PNG, JPEG, GIF, or WebP image.'), { status: 400 });
  if (!bytes?.length) throw Object.assign(new Error('The uploaded image is empty.'), { status: 400 });
  if (bytes.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Images must be 5 MB or smaller.'), { status: 413 });
  const validPrimary = type.signature ? type.signature.every((byte, index) => bytes[index] === byte) : hasAscii(bytes, 0, type.ascii);
  const validSecondary = !type.secondary || hasAscii(bytes, type.secondary.offset, type.secondary.ascii);
  if (!validPrimary || !validSecondary) throw Object.assign(new Error('The file contents do not match the selected image type.'), { status: 400 });
  return sanitizeImageFilename(filename, mimeType);
}

export function imageContentType(path) {
  const extension = path.split('.').at(-1)?.toLowerCase();
  return extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
}
