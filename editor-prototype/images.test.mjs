import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_IMAGE_BYTES, sanitizeImageFilename, validateImagePath, validateImageUpload } from './imageAssets.mjs';

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('image uploads sanitize filenames and verify type signatures', () => {
  assert.equal(validateImageUpload({ filename: 'My Screenshot (Final).PNG', mimeType: 'image/png', bytes: png }), 'my-screenshot-final.png');
  assert.equal(sanitizeImageFilename('../../Résumé map.jpeg', 'image/jpeg'), 'resume-map.jpg');
  assert.throws(() => validateImageUpload({ filename: 'fake.png', mimeType: 'image/png', bytes: Uint8Array.from([1, 2, 3]) }), /contents/);
  assert.throws(() => validateImageUpload({ filename: 'large.png', mimeType: 'image/png', bytes: new Uint8Array(MAX_IMAGE_BYTES + 1) }), /5 MB/);
  assert.throws(() => validateImageUpload({ filename: 'vector.svg', mimeType: 'image/svg+xml', bytes: png }), /PNG, JPEG, GIF, or WebP/);
});

test('repository image paths allow subdirectories but reject traversal', () => {
  assert.equal(validateImagePath('maps/example.webp'), 'maps/example.webp');
  assert.throws(() => validateImagePath('../secret.png'), /Invalid image path/);
  assert.throws(() => validateImagePath('example.svg'), /Invalid image path/);
});
