export const CAPABILITY_PATH = 'editor/publication-capabilities.json';
export async function requireUnpublishCapability({ enabled, readMainCapability }) {
  if (enabled !== 'true') throw Object.assign(new Error('Unpublish is not enabled yet. Your saved work is safe.'), { status: 403 });
  let value;
  try { value = await readMainCapability(); } catch { /* fail closed */ }
  if (value?.version !== 2 || !Array.isArray(value.actions) || !value.actions.includes('unpublish')) throw Object.assign(new Error('Unpublish requires trusted publication validation on main. Contact a maintainer.'), { status: 403 });
}
