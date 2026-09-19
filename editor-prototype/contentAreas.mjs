export const CONTENT_ROOT = 'src/content/docs';

export const CONTENT_AREAS = Object.freeze({
  about: { label: 'About', itemLabel: 'About page', description: true, create: true, publishing: false },
  conference: { label: 'Conference', itemLabel: 'Conference page', description: true, create: true, publishing: false },
  guides: { label: 'Guides', itemLabel: 'Guide', description: true, create: true, publishing: false },
  library: { label: 'Library', itemLabel: 'Library document', description: true, create: true, publishing: false },
  metadata: { label: 'Metadata', itemLabel: 'Metadata page', description: true, create: true, publishing: false },
  projects: { label: 'Projects', itemLabel: 'Project', description: true, create: true, publishing: true },
  scholarship: { label: 'Scholarship', itemLabel: 'Scholarship page', description: true, create: true, publishing: false },
  team: { label: 'Team', itemLabel: 'Team page', description: true, create: true, publishing: false },
  workgroups: { label: 'Workgroups', itemLabel: 'Workgroup', description: false, create: true, publishing: false },
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
