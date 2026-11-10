import assert from 'node:assert/strict';
import test from 'node:test';
import { glob, readFile } from 'node:fs/promises';
import { parse, stringify } from 'yaml';
import { newProgramUpdate, parseProgramUpdate, serializeProgramUpdate, programUpdateConversion, structuredUpdateBody, legacyUpdateBody, saveProgramUpdate } from './programUpdates.mjs';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';

const metadata = (source) => parse(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
const structured = (data, body = "import ProgramUpdateStructured from 'src/components/ProgramUpdateStructured.astro';\n\n<ProgramUpdateStructured data={frontmatter.programUpdate} />\n") => `---\n${stringify({ title: 'Update', date: '2026-10-01T18:30:00-05:00', custom: { keep: true }, programUpdate: data })}---\n\n${body}`;

test('new updates start as drafts with editable staff and tag defaults; the body is unrestricted', () => {
  const source = newProgramUpdate({ title: 'A short update', body: 'Only one announcement.' });
  const parsed = parseProgramUpdate(source);
  assert.equal(parsed.draft, true);
  assert.match(parsed.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(parsed.authors, [{ name: 'BTAA-GIN Staff' }]);
  assert.deepEqual(parsed.tags, ['Program Updates']);
  assert.equal(parsed.conversion, null);
  assert.equal(parsed.body, 'Only one announcement.');
  const changed = serializeProgramUpdate(source, { ...parsed, authors: [], tags: [], date: '2026-11-09', body: '## A different section\n\nA paragraph.' });
  assert.equal(metadata(changed).authors, undefined);
  assert.equal(metadata(changed).tags, undefined);
  assert.equal(metadata(changed).programUpdate, undefined);
  assert.throws(() => newProgramUpdate({ title: 'Update', date: '2026-02-30' }), { status: 400 });
});

test('every existing update round-trips exactly until conversion is explicitly applied', async () => {
  for await (const filename of glob('src/content/docs/updates/*.{md,mdx}')) {
    const source = await readFile(filename, 'utf8');
    const loaded = parseProgramUpdate(source);
    assert.equal(serializeProgramUpdate(source, loaded), source, filename);
    const renamed = serializeProgramUpdate(source, { ...loaded, title: 'Revised title' });
    assert.equal(parseProgramUpdate(renamed).body, loaded.body, filename);
    assert.deepEqual(metadata(renamed).programUpdate, metadata(source).programUpdate, filename);
    if (!loaded.conversion) continue; // New or already-converted articles need no migration.
    assert.equal(loaded.conversion?.error, null, filename);
    assert.ok(loaded.conversion?.body, filename);
    const converted = serializeProgramUpdate(source, { ...loaded, convertProgramUpdate: true, body: loaded.conversion.body });
    const expected = metadata(source);
    if (loaded.conversion.kind === 'structured') delete expected.programUpdate;
    assert.deepEqual(metadata(converted), expected, filename);
    assert.equal(parseProgramUpdate(converted).body, loaded.conversion.body, filename);
  }
});

test('structured conversion includes formatted narratives, images, metrics, comma-containing terms, harvesting tables and priority projects', async () => {
  const source = await readFile('src/content/docs/updates/2026-02-02-january-2026-program-update.mdx', 'utf8');
  const loaded = parseProgramUpdate(source);
  const body = loaded.conversion.body;
  assert.ok(body.includes('lincoln, Nebraska'));
  assert.ok(body.includes('| Metric | Value |'));
  assert.ok(body.includes('Full Scan and replacement of all records from ArcGIS Hubs'));
  assert.ok(body.includes('21,592'));
  assert.ok(body.includes('https://github.com/orgs/geobtaa/projects/22/views/6'));
  assert.match(body, /!\[.*?\]\(<@images\//);
  assert.equal(splitBody(body).filter((segment) => segment.kind === 'protected').length, 0);
  const saved = serializeProgramUpdate(source, { ...loaded, convertProgramUpdate: true, body: body + '\nExtra announcement.\n' });
  const before = metadata(source);
  delete before.programUpdate;
  assert.deepEqual(metadata(saved), before);
  assert.equal(parseProgramUpdate(saved).conversion, null);
  assert.ok(saved.endsWith('Extra announcement.\n'));
});

test('harvesting Markdown tables and rich narratives remain intact; empty sections add no placeholder copy', () => {
  const data = { highlight: { title: 'A highlight', intro: '**Bold** and [a link](https://example.com)\n\n- List item', image: '@images/map.png', imageAlt: 'Map', imageCaption: 'A caption' }, geoportal: { metrics: [{ label: 'Visitors', value: '12,345' }] }, harvestingActivities: '| Task | Added |\n| --- | --- |\n| Scan | 5 |' };
  const body = structuredUpdateBody(data);
  assert.ok(body.includes(data.highlight.intro));
  assert.ok(body.includes(data.harvestingActivities));
  assert.ok(body.includes('*A caption*'));
  assert.doesNotMatch(body, /TBD|Add updates|### Committees|### Workgroups|## Web Development/);
  assert.match(structuredUpdateBody({ highlight: { title: 'Title only' }, workgroups: [{ name: 'Group only' }] }), /## Title only[\s\S]*#### Group only/);
});

test('legacy conversion turns layouts into editable Markdown and keeps unknown nested components and code fences', () => {
  const unknown = '<SpecialChart data={{ values: [1, 2] }}>\n  <Card title="Do not convert">Keep exactly.</Card>\n</SpecialChart>';
  const code = '```mdx\n<Card title="Example">Code example.</Card>\n```';
  const source = `import { Card, CardGrid, LinkCard } from '@astrojs/starlight/components';\n\n<CardGrid>\n<Card title="TECHnology">\n    - **A rich update**\n    - [Link](https://example.com)\n</Card>\n<Card title="Knowledge">\n    Another report.\n</Card>\n</CardGrid>\n\n${unknown}\n\n${code}\n\n<LinkCard title="Keep link" href="/guides/" />\n`;
  const converted = legacyUpdateBody(source);
  assert.match(converted, /#### TECHnology\n\n- \*\*A rich update\*\*/);
  assert.match(converted, /#### Knowledge\n\nAnother report\./);
  assert.ok(converted.includes(unknown));
  assert.ok(converted.includes(code));
  assert.ok(converted.includes("import { Card, CardGrid, LinkCard }"), 'imports still needed by preserved blocks remain');
  assert.doesNotMatch(converted, /<CardGrid>/);
  assert.equal(legacyUpdateBody('<Card title="Unknown import">Keep untouched.</Card>'), null);
  assert.equal(legacyUpdateBody(code), null);
});

test('older real updates preserve CSV tables and embedded presentations while converting supported content', async () => {
  const source = await readFile('src/content/docs/updates/2024-03.mdx', 'utf8');
  const converted = programUpdateConversion(source).body;
  const originals = splitBody(parseProgramUpdate(source).body, { mergeProtected: false });
  for (const segment of originals.filter((segment) => /^\s*<(Table|iframe)\b/.test(segment.content))) assert.ok(converted.includes(segment.content.trim()));
  assert.doesNotMatch(converted, /<TwoThirdsLayout>|<ChipList\b|<CardGrid>/);
  assert.match(converted, /Total records as of/);
});

test('unfamiliar structured fields and custom layouts block conversion without blocking metadata edits', () => {
  for (const source of [structured({ newSection: 'Keep me' }), structured({ highlight: { intro: 'Text' } }, '<ProgramUpdateStructured custom={true} />'), structured({}, '```mdx\n<ProgramUpdateStructured data={frontmatter.programUpdate} />\n```')]) {
    const loaded = parseProgramUpdate(source);
    assert.ok(loaded.conversion.error);
    assert.equal(loaded.conversion.body, null);
    assert.equal(parseProgramUpdate(serializeProgramUpdate(source, { ...loaded, title: 'Renamed' })).body, loaded.body);
    assert.throws(() => serializeProgramUpdate(source, { ...loaded, convertProgramUpdate: true, body: 'Overwrite' }), { status: 400 });
  }
});

test('conversion saves use authoritative content and preserve exact filenames and concurrent-edit checks', async () => {
  const source = structured({ highlight: { intro: 'Original.' } });
  const loaded = parseProgramUpdate(source);
  const writes = [];
  const github = { getContent: async (area, filename) => { assert.equal(area, 'updates'); assert.equal(filename, '2026-01.mdx'); return { content: source, sha: 'loaded' }; }, saveContent: async (input) => { writes.push(input); return { sha: 'saved', commitSha: 'commit' }; } };
  const input = { ...loaded, sha: 'loaded', originalContent: structured({ unexpected: 'Client cannot substitute this' }), convertProgramUpdate: true, body: loaded.conversion.body };
  assert.throws(() => serializeProgramUpdate(source, { ...loaded, convertProgramUpdate: true }), { status: 400 });
  const result = await saveProgramUpdate(github, '2026-01.mdx', input);
  assert.equal(result.filename, '2026-01.mdx');
  assert.deepEqual(metadata(result.content).custom, { keep: true });
  assert.equal(metadata(result.content).date, '2026-10-01T18:30:00-05:00');
  await assert.rejects(saveProgramUpdate(github, '2026-01.mdx', { ...input, sha: 'stale' }), { status: 409 });
  await assert.rejects(saveProgramUpdate(github, '2026-01.mdx', { title: 'Overwrite' }), { status: 400 });
  assert.equal(writes.length, 1);
});
