// Both the editor and the site accept the same small, versionable data shape.
export function parseCollectionData(kind, source) {
  try {
    const data = JSON.parse(source);
    if (!Array.isArray(data)) return null;
    if (kind === 'chipList') return data.every(item => typeof item === 'string') ? data : null;
    if (kind === 'cardGrid') return data.every(card => card && typeof card === 'object' && !Array.isArray(card) && Object.keys(card).length === 2 && typeof card.title === 'string' && typeof card.body === 'string') ? data : null;
    if (kind === 'metrics') return data.every(item => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).length === 2 && typeof item.label === 'string' && typeof item.value === 'string') ? data : null;
    return null;
  } catch { return null; }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
