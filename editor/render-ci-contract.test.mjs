import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {parse,stringify} from 'yaml';
import {validateSourceText} from './sourcePullRequest.mjs';
const path='.github/workflows/validate.yml';

async function contract(isolated) {
 const workflow=parse(await readFile(path,'utf8')),jobs=workflow.jobs,gate=jobs.validate.steps[0];
 delete jobs['render-tests'];delete gate.env.RENDER_RESULT;
 jobs['site-validation'].steps=jobs['site-validation'].steps.filter(step=>step.run!=='npm run test:editor:render');
 jobs.validate.needs=['publication-plan','site-validation','browser-tests'];
 gate.run=gate.run.replace(' && test "$RENDER_RESULT" = "success"','');
 if(isolated){
  jobs['render-tests']={'runs-on':'ubuntu-latest',steps:[{uses:'actions/checkout@v4',with:{'persist-credentials':false}},{uses:'actions/setup-node@v4',with:{'node-version-file':'.node-version',cache:'npm'}},{run:'npm ci'},{run:'npm run test:editor:render'}]};
  jobs.validate.needs.push('render-tests');gate.env.RENDER_RESULT='${{ needs.render-tests.result }}';
  gate.run=gate.run.replace(' || exit 1',' && test "$RENDER_RESULT" = "success" || exit 1');
 }else jobs['site-validation'].steps.push({run:'npm run test:editor:render'});
 return workflow;
}
const check=workflow=>validateSourceText(path,stringify(workflow));
test('trusted validator accepts installed render coverage and its separately activated isolated equivalent',async()=>{
 for(const isolated of [false,true]){const workflow=await contract(isolated);assert.doesNotThrow(()=>check(workflow));}
 const installed=await readFile(path,'utf8');assert.doesNotThrow(()=>validateSourceText(path,installed));
});

test('neither CI contract can omit render fixtures or skip them for CMS publications',async()=>{
 for(const isolated of [false,true])for(const change of [job=>{job.if="needs.publication-plan.outputs.kind != 'cms-snapshot'";},job=>{job.steps.find(step=>step.run==='npm run test:editor:render').if='false';},job=>{job.steps.find(step=>step.run==='npm run test:editor:render').run='echo skipped';},job=>{job.steps.find(step=>step.run==='npm run test:editor:render')['continue-on-error']=true;}]){
  const workflow=await contract(isolated);change(workflow.jobs[isolated?'render-tests':'site-validation']);assert.throws(()=>check(workflow),/render fixtures/);
 }
});

test('isolated render coverage must run the PR checkout and bind its actual result into required validate',async()=>{
 const changes=[
  jobs=>{jobs['render-tests'].steps[0].with.ref='${{ github.event.pull_request.base.sha }}';},
  jobs=>{jobs['render-tests'].steps.find(step=>step.run==='npm ci').if='false';},
  jobs=>{jobs['render-tests']['continue-on-error']=true;},
  jobs=>{jobs.validate.needs.pop();},
  jobs=>{jobs.validate.steps[0].env.RENDER_RESULT='success';},
  jobs=>{jobs.validate.steps[0].run=jobs.validate.steps[0].run.replace(' && test "$RENDER_RESULT" = "success"','');},
  jobs=>{jobs['site-validation'].steps.push({run:'npm run test:editor:render'});},
  jobs=>{jobs['browser-tests'].if='false';},
 ];
 for(const change of changes){const workflow=await contract(true);change(workflow.jobs);assert.throws(()=>check(workflow),/CI coverage/);}
});

test('browser contract requires the complete current suite and rejects obsolete or partial coverage', async () => {
 for (const command of ['node --test --test-concurrency=1 editor/*.browser.mjs']) {
  const workflow = await contract(true);
  const step = workflow.jobs['browser-tests'].steps.find(step => step.run?.startsWith('node --test'));
  step.run = command;
  assert.doesNotThrow(() => check(workflow));
  step.run = 'node --test --test-concurrency=1 editor-prototype/*.browser.mjs';
  assert.throws(() => check(workflow), /complete browser suite/);
  step.run = 'node --test editor/preview.browser.mjs';
  assert.throws(() => check(workflow), /complete browser suite/);
 }
});
