import ts from 'typescript';
import { parseDocument } from 'yaml';
import { parseContent } from './content.mjs';
import { validateDocument } from './validateDocument.mjs';
import { imageContentType, validateImageUpload } from './imageAssets.mjs';
const invalid = message => Object.assign(new Error(message), { status: 403 });
export const sensitiveSourcePath = path => /^(?:functions\/|editor-prototype\/|scripts\/|\.github\/|patches\/|src\/(?:components|utils|layouts)\/)/.test(path) || /(?:^|\/)(?:package(?:-lock)?\.json|[^/]*config\.[^/]+|\.node-version|\.env[^/]*)$/.test(path);
function yaml(source, path) {
  const doc = parseDocument(source);
  if (doc.errors.length) throw invalid(`Invalid YAML in ${path}.`);
  return doc.toJS();
}
export function validateSourceText(path, source, original = '') {
  if (source.includes('\0') || /^(?:<{7} |={7}$|>{7} )/m.test(source)) throw invalid(`Binary text or unresolved conflict markers in ${path}.`);
  if (/(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16})/.test(source)) throw invalid(`Possible committed credential in ${path}. Remove it and investigate exposure; the check does not print the value.`);
  if (/(?:^|\/)\.env(?:\.|$)/.test(path) && !/\.(?:example|sample|template)$/.test(path)) throw invalid(`Do not commit runtime credentials/configuration in ${path}; use deployment secrets.`);
  if (/\.[cm]?[jt]sx?$/.test(path)) {
    const kind = /\.tsx$/.test(path) ? ts.ScriptKind.TSX : /\.jsx$/.test(path) ? ts.ScriptKind.JSX : /\.(?:ts|mts|cts)$/.test(path) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
    if (ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, kind).parseDiagnostics.length) throw invalid(`Invalid JavaScript/TypeScript syntax in ${path}.`);
  }
  if (path === 'package.json' || path === 'package-lock.json') {
    let data; try { data = JSON.parse(source); } catch { throw invalid(`Invalid JSON in ${path}.`); }
    if (path === 'package.json' && (!data || typeof data !== 'object' || !data.scripts || typeof data.scripts !== 'object')) throw invalid('package.json requires a scripts object; dependency installation/build validation also remains required.');
    if (path === 'package-lock.json') {
      if (data?.lockfileVersion !== 3 || !data.packages?.['']) throw invalid('Unsupported dependency lock format. Regenerate the npm v3 lockfile.');
      for (const entry of Object.values(data.packages)) if (entry.resolved && (!entry.resolved.startsWith('https://') || typeof entry.integrity !== 'string' || !/^sha(?:256|384|512)-/.test(entry.integrity))) throw invalid('Dependency lock entries require HTTPS resolution and integrity hashes.');
    }
  }
  if (/^\.github\/workflows\/.*\.ya?ml$/.test(path)) {
    const workflow = yaml(source, path);
    if (!workflow || typeof workflow !== 'object' || !workflow.jobs) throw invalid(`Invalid workflow structure in ${path}.`);
    const events = typeof workflow.on === 'string' ? [workflow.on] : Array.isArray(workflow.on) ? workflow.on : Object.keys(workflow.on || {});
    if (events.some(event => ['pull_request_target', 'workflow_run'].includes(event))) throw invalid(`Privileged PR/indirect workflow triggers are not permitted by the source policy: ${path}.`);
    if (events.some(event => event.startsWith('pull_request'))) {
      const readOnly = permissions => permissions === 'read-all' || (permissions && typeof permissions === 'object' && Object.values(permissions).every(value => ['read', 'none'].includes(value)));
      if (!readOnly(workflow.permissions) || Object.values(workflow.jobs).some(job => job.permissions && !readOnly(job.permissions)) || /\$\{\{\s*secrets\./i.test(source)) throw invalid(`PR workflows must use explicit read-only permissions without repository secrets: ${path}.`);
    }
    if (path === '.github/workflows/validate.yml') {
      const jobs = workflow.jobs, plan = jobs['publication-plan'], browser = jobs['browser-tests'], gate = jobs.validate;
      const render = jobs['render-tests'], isolatedRender = render !== undefined;
      const require = (condition, message) => { if (!condition) throw invalid(`Required CI coverage is unsafe: ${message}.`); };
      require(plan?.outputs?.kind === '${{ steps.plan.outputs.kind }}', 'classification output must come from the trusted plan step');
      require(plan.steps?.some(step => step.uses?.startsWith('actions/checkout@') && step.with?.ref === '${{ github.event.pull_request.base.sha || github.sha }}' && step.with?.['persist-credentials'] === false), 'classify from trusted base, without checkout credentials');
      const classifier = plan.steps?.find(step => step.id === 'plan');
      require(classifier?.run?.trim() === `if [ "$GITHUB_EVENT_NAME" != "pull_request" ] || [ ! -f scripts/check-cms-publication.mjs ]; then
  # Bootstrap/manual runs never earn a browser skip.
  echo "kind=full-suite" >> "$GITHUB_OUTPUT"
else
  node scripts/check-cms-publication.mjs --github-output
fi`, 'use verified classification; missing checker must select the full suite');
      require(browser?.needs === 'publication-plan' && browser.if === "needs.publication-plan.result == 'success' && needs.publication-plan.outputs.kind != 'cms-snapshot'", 'ordinary source must run browsers');
      require(browser.steps?.some(step => step.run === 'test -x /usr/bin/google-chrome') && browser.steps?.some(step => step.run === 'node --test --test-concurrency=1 editor-prototype/*.browser.mjs' && step.env?.CHROME_BIN === '/usr/bin/google-chrome'), 'require Chrome and the complete browser suite');
      // Support the installed contract and a separately activated isolated job.
      // Either form must run render fixtures for CMS snapshots as well as source PRs.
      const unconditionalRun = (job, command) => job?.steps?.some(step => step.run === command && step.if === undefined && step['continue-on-error'] === undefined);
      const renderJob = isolatedRender ? render : jobs['site-validation'];
      require(renderJob?.if === undefined && renderJob?.['continue-on-error'] === undefined && unconditionalRun(renderJob,'npm run test:editor:render'), 'render fixtures must run unconditionally');
      if (isolatedRender) {
        require(render['runs-on'] === 'ubuntu-latest', 'render fixtures require their own runner');
        require(render.steps?.some(step => step.uses?.startsWith('actions/checkout@') && step.if === undefined && step.with?.ref === undefined && step.with?.['persist-credentials'] === false) && render.steps?.some(step => step.uses?.startsWith('actions/setup-node@') && step.if === undefined && step.with?.['node-version-file'] === '.node-version') && unconditionalRun(render,'npm ci'), 'isolated render fixtures must install and test the PR checkout');
        require(!jobs['site-validation']?.steps?.some(step => step.run?.includes('test:editor:render')), 'render fixtures must not also mutate the site-build workspace');
      }
      const requiredJobs = ['publication-plan', 'site-validation', 'browser-tests', ...(isolatedRender ? ['render-tests'] : [])];
      require(gate?.if === 'always()' && JSON.stringify(gate.needs) === JSON.stringify(requiredJobs), 'the required validate gate must aggregate every result even after failures');
      const final = gate.steps?.[0];
      require(final?.env?.KIND === '${{ needs.publication-plan.outputs.kind }}' && final.env.PLAN_RESULT === '${{ needs.publication-plan.result }}' && final.env.SITE_RESULT === '${{ needs.site-validation.result }}' && final.env.BROWSER_RESULT === '${{ needs.browser-tests.result }}', 'bind final gate to actual job results');
      if (isolatedRender) require(final.env.RENDER_RESULT === '${{ needs.render-tests.result }}', 'bind render coverage to its actual job result');
      require(final.run?.trim() === `test "$PLAN_RESULT" = "success" && test "$SITE_RESULT" = "success"${isolatedRender ? ' && test "$RENDER_RESULT" = "success"' : ''} || exit 1
case "$KIND" in
  cms-snapshot) test "$BROWSER_RESULT" = "skipped" ;;
  validated-source|full-suite) test "$BROWSER_RESULT" = "success" ;;
  *) echo "Unknown publication classification; validation blocked."; exit 1 ;;
esac`, 'fail closed on failures, unknown classification and inappropriate skips');
    }
    if (path === '.github/workflows/cms-publication-scope.yml') {
      const steps = workflow.jobs['cms-publication-scope']?.steps || [];
      if (!steps.some(step => step.uses?.startsWith('actions/checkout@') && step.with?.ref === '${{ github.event.pull_request.base.sha }}' && step.with?.['persist-credentials'] === false) || !steps.some(step => step.run === 'node scripts/check-cms-publication.mjs')) throw invalid('The scope workflow must execute the trusted base checker with checkout credentials disabled.');
    }
  }
  if (/\.mdx?$/.test(path) && /^---\r?\n/.test(source)) {
    const metadata = value => yaml(value.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1], path);
    const before = /^---\r?\n/.test(original) ? metadata(original) : {}, after = metadata(source);
    for (const field of ['head', 'layout']) if (JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])) throw invalid(`Executable frontmatter ${field} cannot change in ${path}; adjust the source policy explicitly for intentional executable source work.`);
  }
}

// Inspect complete Git trees, not a potentially truncated PR-files listing.
// This job treats head source as data; only the separate read-only validate job builds it.
export async function validateSourcePullRequest({ request, pr }) {
  const ref = await request('/git/ref/heads/main');
  const baseline = ref.object?.sha;
  if (!/^[a-f0-9]{40}$/.test(baseline || '')) throw invalid('Current main is unavailable.');
  const comparison = await request(`/compare/${baseline}...${pr.head.sha}`);
  if (!['ahead', 'identical'].includes(comparison.status) || comparison.merge_base_commit?.sha !== baseline) throw invalid('Update the ordinary PR with current main and rerun automated validation.');
  const snapshot = async head => {
    const commit = await request(`/git/commits/${head}`);
    const tree = await request(`/git/trees/${commit.tree.sha}?recursive=1`);
    if (tree.truncated !== false || !Array.isArray(tree.tree)) throw invalid('Source tree inventory is incomplete.');
    return new Map(tree.tree.filter(file => file.type !== 'tree').map(file => [file.path, file]));
  };
  const [base, head] = await Promise.all([snapshot(baseline), snapshot(pr.head.sha)]);
  const changed = [...new Set([...base.keys(), ...head.keys()])].filter(path => { const a = base.get(path), b = head.get(path); return a?.sha !== b?.sha || a?.mode !== b?.mode || a?.type !== b?.type; });
  if (changed.length > 500) throw invalid('Source PR exceeds the 500-file security inspection limit. Split the PR.');
  let bytesRead = 0;
  const bytes = async file => {
    const blob = await request(`/git/blobs/${file.sha}`);
    if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw invalid('Source blob could not be inspected.');
    const value = Uint8Array.from(atob(blob.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    bytesRead += value.length;
    if (bytesRead > 20_000_000) throw invalid('Source security inspection exceeds 20 MB. Split the PR.');
    return value;
  };
  const text = value => { try { return new TextDecoder('utf-8', { fatal: true }).decode(value); } catch { throw invalid('Uninspectable binary source. Use supported images or extend the source policy explicitly.'); } };
  const sensitiveFiles = [];
  for (const path of changed) {
    const before = base.get(path), after = head.get(path);
    if ([before, after].filter(Boolean).some(file => file.type !== 'blob' || file.mode !== '100644')) throw invalid(`Source changes must use regular non-executable files: ${path}.`);
    if (sensitiveSourcePath(path)) sensitiveFiles.push(path);
    if (!after) {
      if (['.github/workflows/cms-publication-scope.yml', '.github/workflows/validate.yml', 'scripts/check-cms-publication.mjs', 'editor-prototype/publicationPolicy.mjs', 'editor-prototype/sourcePullRequest.mjs', 'editor-prototype/pullRequestEligibility.mjs'].includes(path)) throw invalid(`Required validation machinery cannot be deleted: ${path}.`);
      continue;
    }
    const value = await bytes(after);
    if (/\.(png|jpe?g|gif|webp)$/i.test(path)) { validateImageUpload({ filename: path, mimeType: imageContentType(path), bytes: value }); continue; }
    const source = text(value), original = before && /\.mdx?$/.test(path) ? text(await bytes(before)) : '';
    validateSourceText(path, source, original);
    if (/\.mdx?$/.test(path)) {
      // Includes standalone MDX without frontmatter and protected legacy source.
      const wrap = body => `---\ntitle: Source document\n---\n\n${body}`;
      const content = /^---\r?\n/.test(source) ? source : wrap(source);
      const originalBody = original ? (/^---\r?\n/.test(original) ? parseContent(original).body : original) : '';
      await validateDocument(content, { filename: path, originalBody });
    }
  }
  if ((await request('/git/ref/heads/main')).object?.sha !== baseline) throw invalid('Main changed during source validation. Rerun checks.');
  return { changedFiles: changed.length, sensitiveFiles };
}
