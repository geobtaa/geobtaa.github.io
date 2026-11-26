import { BLOG_PAGE_SIZE, matchesArchiveItem, readArchiveSelection } from '../utils/blogArchive';

export function initializeBlogArchive() {
  const root = document.querySelector<HTMLElement>('[data-blog-archive]');
  if (!root || root.dataset.ready) return;
  const form = root.querySelector<HTMLFormElement>('[data-archive-controls]')!;
  const query = form.querySelector<HTMLInputElement>('[name="q"]')!;
  const year = form.querySelector<HTMLSelectElement>('[name="year"]')!;
  const more = root.querySelector<HTMLButtonElement>('[data-archive-more]')!;
  const count = root.querySelector<HTMLElement>('[data-archive-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-archive-empty]')!;
  const cards = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-blog-card]'));
  let selection = readArchiveSelection(new URLSearchParams(location.search), Number(root.dataset.page));
  // Stale year links should never leave a hidden, unexplained selection.
  if (!Array.from(year.options).some(option => option.value === selection.year)) selection.year = '';

  const populate = () => {
    query.value = selection.query;
    year.value = selection.year;
    form.querySelectorAll<HTMLInputElement>('[name="type"]').forEach(input => { input.checked = input.value === selection.type; });
  };
  const render = () => {
    const matches = cards.filter(card => matchesArchiveItem({
      category: card.dataset.category ?? '', year: card.dataset.year ?? '', search: card.dataset.search ?? '',
    }, selection));
    const visible = new Set(matches.slice(0, selection.shown));
    cards.forEach(card => { card.hidden = !visible.has(card); });
    count.textContent = `Showing ${visible.size} of ${matches.length}${selection.query || selection.type !== 'all' || selection.year ? ' matching posts' : ' posts'}`;
    empty.hidden = matches.length !== 0;
    more.hidden = visible.size >= matches.length;
    return matches;
  };
  const save = () => {
    const params = new URLSearchParams();
    if (selection.query) params.set('q', selection.query);
    if (selection.type !== 'all') params.set('type', selection.type);
    if (selection.year) params.set('year', selection.year);
    if (selection.shown > BLOG_PAGE_SIZE) params.set('shown', String(selection.shown));
    history.replaceState(history.state, '', `/blog/${params.size ? `?${params}` : ''}`);
  };
  const update = () => {
    selection = { query: query.value.trim(), type: String(new FormData(form).get('type') ?? 'all'), year: year.value, shown: BLOG_PAGE_SIZE };
    history.replaceState(null, '');
    render(); save();
  };
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('input', event => { if (event.target === query) update(); });
  form.addEventListener('change', event => { if (event.target !== query) update(); });
  form.addEventListener('reset', event => {
    event.preventDefault();
    selection = { query: '', type: 'all', year: '', shown: BLOG_PAGE_SIZE };
    history.replaceState(null, '');
    populate(); render(); save();
  });
  more.addEventListener('click', () => {
    const previous = selection.shown;
    selection.shown += BLOG_PAGE_SIZE;
    const matches = render(); save();
    // Move focus to the first newly revealed card, including the final batch.
    matches[previous]?.focus({ preventScroll: true });
  });
  root.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-blog-card]')) return;
    const card = event.target.closest<HTMLAnchorElement>('[data-blog-card]')!;
    history.replaceState({ ...history.state, archiveScroll: scrollY, archiveCard: card.getAttribute('href') }, '');
  });
  const restorePosition = () => {
    const state = history.state;
    if (typeof state?.archiveScroll !== 'number') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cards.find(card => card.getAttribute('href') === state.archiveCard && !card.hidden)?.focus({ preventScroll: true });
      window.scrollTo(0, state.archiveScroll);
    }));
  };
  window.addEventListener('pageshow', restorePosition);
  window.addEventListener('popstate', () => {
    selection = readArchiveSelection(new URLSearchParams(location.search));
    populate(); render(); restorePosition();
  });
  populate(); render(); save();
  form.hidden = false;
  root.querySelector<HTMLElement>('[data-archive-pagination]')!.hidden = true;
  root.dataset.ready = 'true';
  restorePosition();
}
