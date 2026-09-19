export const CONTENT_ROOT = 'src/content/docs';

export const CONTENT_AREAS = Object.freeze({
  about: { label: 'About', description: true, create: false, publishing: false },
  conference: { label: 'Conference', description: true, create: false, publishing: false },
  guides: { label: 'Guides', description: true, create: false, publishing: false },
  library: { label: 'Library', description: true, create: false, publishing: false },
  metadata: { label: 'Metadata', description: true, create: false, publishing: false },
  projects: { label: 'Projects', description: true, create: true, publishing: true },
  scholarship: { label: 'Scholarship', description: true, create: false, publishing: false },
  team: { label: 'Team', description: true, create: false, publishing: false },
  workgroups: { label: 'Workgroups', description: false, create: false, publishing: false },
});

export function contentArea(name) {
  return Object.prototype.hasOwnProperty.call(CONTENT_AREAS, name) ? CONTENT_AREAS[name] : null;
}

export function contentDirectory(name) {
  if (!contentArea(name)) throw Object.assign(new Error('This content directory is not enabled in the editor.'), { status: 404 });
  return `${CONTENT_ROOT}/${name}`;
}

export function validateContentPath(value) {
  const decoded = decodeURIComponent(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*\.mdx?$/.test(decoded) || decoded.includes('..') || decoded.includes('//')) {
    throw Object.assign(new Error('Invalid content filename.'), { status: 400 });
  }
  return decoded;
}

export function encodeContentPath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}
