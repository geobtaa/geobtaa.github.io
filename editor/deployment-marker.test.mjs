import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const script = resolve('scripts/write-cms-deployment.mjs');
test('real marker CLI binds Git source, main-only runtime and the actual rendered output without repository writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'cms-marker-'));
  const git = args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim();
  try {
    await mkdir(join(dir,'src/content/docs/library'), {recursive:true}); await mkdir(join(dir,'dist/library/report'), {recursive:true});
    await writeFile(join(dir,'src/content/docs/library/report.mdx'),'---\ntitle: Report\n---\n\nSource.');
    await writeFile(join(dir,'dist/library/report/index.html'),'<html>Rendered source.</html>');
    git(['init','-q','-b','main']); git(['add','src']);
    git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','-qm','Fixture']);
    const sha=git(['rev-parse','HEAD']);
    const env={...process.env,GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'geobtaa/geobtaa.github.io',GITHUB_SHA:sha,GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1'};
    let run=spawnSync(process.execPath,[script],{cwd:dir,env,encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const marker=JSON.parse(await readFile(join(dir,'dist/_cms/deployment.json'),'utf8'));
    assert.equal(marker.sha,sha);assert.equal(marker.runId,123);assert.equal(marker.documents['src/content/docs/library/report.mdx'].blob,git(['rev-parse','HEAD:src/content/docs/library/report.mdx']));
    run=spawnSync(process.execPath,[script],{cwd:dir,env:{...env,GITHUB_REF:'refs/heads/cms/drafts/report'},encoding:'utf8'});assert.notEqual(run.status,0);
    await writeFile(join(dir,'src/content/docs/library/report.mdx'),'Changed after build');
    run=spawnSync(process.execPath,[script],{cwd:dir,env,encoding:'utf8'});assert.notEqual(run.status,0);
  }finally{await rm(dir,{recursive:true,force:true});}
});
