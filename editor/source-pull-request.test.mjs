import assert from 'node:assert/strict';
import test from 'node:test';
import { draftTestRepository } from './draftTestRepository.mjs';
import { verifyPullRequestEligibility } from './pullRequestEligibility.mjs';
import { validateSourceText } from './sourcePullRequest.mjs';
async function sourceFixture({ initial = {}, changes = { 'functions/example.js': 'export const value = 1;' } } = {}) {
  const repo = await draftTestRepository(initial), main = repo.refs.get('refs/heads/main');
  const ref = 'feature/ordinary-source'; repo.refs.set(`refs/heads/${ref}`, main);
  let head = main;
  for (const [path, value] of Object.entries(changes)) head = await repo.put(path, value, { branch: ref });
  const pr = { number: 1, state: 'open', user: { login: 'karenmajewicz' }, base: { ref: 'main' }, head: { ref, sha: head, repo: { full_name: 'geobtaa/geobtaa.github.io' } } };
  const request = (path, options) => path === '/pulls/1' ? structuredClone(pr) : repo.request(path, options);
  const reports = [];
  return { repo, pr, reports, options: { request, store: { verifyPublication() { throw new Error('Ordinary PRs never gain CMS eligibility'); } }, pr, repository: 'geobtaa/geobtaa.github.io', report: summary => reports.push(summary) } };
}
test('a writer can pass ordinary application/authentication changes without approval or reviewer lookups', async () => {
  const { repo, options, reports } = await sourceFixture();
  for (const login of ['karenmajewicz', 'ewlarson', 'colleenumn']) { options.pr.user.login = login; assert.equal(await verifyPullRequestEligibility(options), 'validated-source'); }
  assert.deepEqual(reports[0].sensitiveFiles, ['functions/example.js']);
  assert.equal(repo.requests.some(item => /reviews|collaborators/.test(item.path)), false);
});
test('ordinary safe MDX changes pass but new expressions, scripts, imports and protected changes fail', async () => {
  const path = 'src/content/docs/library/source.mdx', original = '---\ntitle: Report\n---\n\nOriginal.';
  const safe = await sourceFixture({ initial: { [path]: original }, changes: { [path]: original.replace('Original.', 'Edited ordinary content.') } });
  assert.equal(await verifyPullRequestEligibility(safe.options), 'validated-source');
  for (const body of ['{process.env.SECRET}', '<script>alert(1)</script>', "import attack from './attack.js';\n\n<attack />"]) {
    const value = await sourceFixture({ initial: { [path]: original }, changes: { [path]: original + '\n\n' + body } });
    await assert.rejects(verifyPullRequestEligibility(value.options), /MDX|read-only|unsupported/);
  }
  const prior = original + '\n\n<Unknown>Protected.</Unknown>\n';
  const changed = await sourceFixture({ initial: { [path]: prior }, changes: { [path]: prior.replace('Protected.', 'Changed.') } });
  await assert.rejects(verifyPullRequestEligibility(changed.options), /read-only/);
});
test('new standalone MDX and executable frontmatter cannot bypass source checks', async () => {
  for (const content of ['export const evil = 1;\n\n# Page', '---\ntitle: Report\nhead:\n  - tag: script\n    content: attack()\n---\n\nText.', '---\ntitle: Report\nlayout: ../../arbitrary.js\n---\n\nText.']) {
    const value = await sourceFixture({ changes: { 'src/content/docs/library/new.mdx': content } });
    await assert.rejects(verifyPullRequestEligibility(value.options));
  }
});
test('CMS-looking ordinary branches and CMS metadata cannot grant snapshot eligibility', async () => {
  const value = await sourceFixture();
  value.pr.head.ref = 'cms/publish/forged';
  await assert.rejects(verifyPullRequestEligibility(value.options), /never gain CMS eligibility/);
  value.pr.head.ref = 'cms/drafts/forged';
  await assert.rejects(verifyPullRequestEligibility(value.options), /Reserved CMS/);
});
test('workflow escalation, dependency integrity, syntax and credential guards inspect security-sensitive changes', async () => {
  const cases = [
    ['.github/workflows/unsafe.yml', 'on: pull_request_target\njobs: {}'],
    ['.github/workflows/unsafe.yml', 'on: pull_request\npermissions: write-all\njobs: {}'],
    ['.github/workflows/unsafe.yml', 'on: pull_request\npermissions:\n  contents: read\njobs:\n  build:\n    permissions:\n      contents: write'],
    ['.github/workflows/unsafe.yml', 'on: pull_request\npermissions:\n  contents: read\njobs:\n  build:\n    env:\n      TOKEN: "${{ secrets.DEPLOY_KEY }}"'],
    ['package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': {}, module: { resolved: 'http://insecure.test/file', integrity: 'sha512-example' } } })],
    ['functions/auth.js', 'export function broken( {'],
    ['functions/auth.js', "const token = '" + 'gh' + 'p_' + 'a'.repeat(36) + "';"],
    ['.env.production', 'TOKEN=example'],
  ];
  for (const [path, content] of cases) {
    const value = await sourceFixture({ changes: { [path]: content } });
    await assert.rejects(verifyPullRequestEligibility(value.options), undefined, path);
  }
  assert.doesNotThrow(() => validateSourceText('package-lock.json', JSON.stringify({ lockfileVersion: 3, packages: { '': {}, module: { resolved: 'https://registry.npmjs.org/file', integrity: 'sha512-example' } } })));
});
test('source scanner is fail-closed on incomplete trees, stale main, non-regular files and a changing PR', async () => {
  const stale = await sourceFixture(); await stale.repo.put('main-change.js', 'Unrelated change');
  await assert.rejects(verifyPullRequestEligibility(stale.options), /current main/);
  const incomplete = await sourceFixture(), read = incomplete.options.request;
  incomplete.options.request = async (path, options) => path.startsWith('/git/trees/') ? { truncated: true, tree: [] } : read(path, options);
  await assert.rejects(verifyPullRequestEligibility(incomplete.options), /incomplete/);
  const link = await sourceFixture(); link.pr.head.sha = await link.repo.put('dangerous.js', '/secret', { branch: link.pr.head.ref, mode: '120000' });
  await assert.rejects(verifyPullRequestEligibility(link.options), /regular/);
  const changed = await sourceFixture(), request = changed.options.request;
  changed.options.request = path => path === '/pulls/1' ? { ...changed.pr, head: { ...changed.pr.head, sha: 'f'.repeat(40) } } : request(path);
  await assert.rejects(verifyPullRequestEligibility(changed.options), /changed during/);
});
test('changes to the scope workflow must retain trusted-base execution and validation files cannot be deleted', async () => {
  assert.throws(() => validateSourceText('.github/workflows/cms-publication-scope.yml', 'on: pull_request\npermissions:\n  contents: read\njobs:\n  cms-publication-scope:\n    steps:\n      - run: echo bypass'), /trusted base checker/);
  const value = await sourceFixture({ initial: { 'scripts/check-cms-publication.mjs': 'export const initial = true;' } });
  value.repo.filesAt(value.pr.head.sha).delete('scripts/check-cms-publication.mjs');
  await assert.rejects(verifyPullRequestEligibility(value.options), /cannot be deleted/);
});

test('legacy MDX layout patterns allow ordinary prose edits outside a protected layout but reject text changes inside it', async () => {
  // Pattern also checked against the existing foundation report during release audit.
  // Synthetic content avoids making routine edits to that report break CI.
  const path = 'src/content/docs/library/legacy-layout.mdx';
  const original = '---\ntitle: Report\n---\n\nQ1 2025 - Q1 2026\n\n<div class="gold-highlight">\n\nKey accomplishments\n\n* Existing content\n\n</div>\n';
  const outside = await sourceFixture({ initial: { [path]: original }, changes: { [path]: original.replace('Q1 2025 - Q1 2026', 'Q1 2025 through Q1 2026') } });
  assert.equal(await verifyPullRequestEligibility(outside.options), 'validated-source');
  const inside = await sourceFixture({ initial: { [path]: original }, changes: { [path]: original.replace('Key accomplishments', 'Main accomplishments') } });
  await assert.rejects(verifyPullRequestEligibility(inside.options), /read-only|unsupported/);
});

test('relocated validation modules remain protected from deletion and editor changes remain sensitive', async () => {
 for (const name of ['publicationPolicy.mjs', 'sourcePullRequest.mjs', 'pullRequestEligibility.mjs']) {
  const path = `editor/${name}`;
  const value = await sourceFixture({ initial: { [path]: 'export const initial = true;' } });
  value.repo.filesAt(value.pr.head.sha).delete(path);
  await assert.rejects(verifyPullRequestEligibility(value.options), /cannot be deleted/);
 }
 const value = await sourceFixture({ changes: { 'editor/example.mjs': 'export const value = 1;' } });
 assert.equal(await verifyPullRequestEligibility(value.options), 'validated-source');
 assert.deepEqual(value.reports[0].sensitiveFiles, ['editor/example.mjs']);
});
