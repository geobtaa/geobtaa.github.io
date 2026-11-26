import { getCollection } from 'astro:content';

export async function loadConferenceYears() {
  // Published year-named pages supply navigation labels without editing archives.
  const events = await getCollection('docs', ({ id, data }) =>
    /^conference\/\d{4}$/.test(id) && data.draft !== true
  );
  return events.map(({ id }) => id.split('/')[1]).sort((a, b) => Number(b) - Number(a));
}
