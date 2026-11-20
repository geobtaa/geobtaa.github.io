// Activate this workflow contract test in release PR 2, with the Pages workflow.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'yaml';
test('production workflow serializes deployments, rejects non-main dispatch and always generates the artifact marker', async () => {
  const workflow=parse(await readFile('.github/workflows/astro.yml','utf8'));
  assert.deepEqual(workflow.on.push.branches,['main']);assert.equal(workflow.on.push.paths,undefined);
  assert.equal(workflow.concurrency['cancel-in-progress'],false);
  for(const name of ['build','deploy'])assert.match(workflow.jobs[name].if,/github.ref == 'refs\/heads\/main'/);
  const build=workflow.jobs.build.steps, marker=build.findIndex(step=>step.run==='node scripts/write-cms-deployment.mjs');
  assert.ok(marker>0);assert.ok(marker<build.findIndex(step=>step.uses?.startsWith('actions/upload-pages-artifact@')));
  assert.match(workflow.jobs.deploy.steps[0].run,/current_main.*GITHUB_SHA/s);
});
