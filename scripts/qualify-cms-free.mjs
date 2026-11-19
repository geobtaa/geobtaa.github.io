// Local-only release qualification. Every fetch is replaced by the in-memory
// GitHub model; this program cannot send repository writes or deploy anything.
// Node CPU includes mock-transport work and is NOT Cloudflare CPU telemetry.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { draftTestRepository } from '../editor-prototype/draftTestRepository.mjs';
import { createDraftStore, prepareDraftImage } from '../editor-prototype/draftStorage.mjs';
import { parsePage, savePage } from '../editor-prototype/page.mjs';
import { preparePublicationCandidate } from '../editor-prototype/publicationCandidate.mjs';
import { onRequest } from '../functions/api/[[path]].js';
const self = fileURLToPath(import.meta.url), origin = 'https://gin-editor.pages.dev';
const area = 'library', filename = 'qualification.mdx', path = `src/content/docs/${area}/${filename}`;
const contentURL = `/api/content/${area}/${filename}`, publishURL = `/api/publish/${area}/${filename}`;
const body = size => { const line='Representative editorial paragraph with **bold**, [a link](https://example.org/), and plain text.\n\n'; return line.repeat(Math.floor(size / line.length))+'x'.repeat(size % line.length); };
const scenarios = [
  { id: 'reopen-small', operation: 'reopen' }, { id: 'discovery-small', operation: 'discovery' },
  { id: 'save-small', operation: 'save' }, { id: 'save-32KiB', operation: 'save', documentChars: 32 * 1024 },
  { id: 'save-128KiB', operation: 'save', documentChars: 128 * 1024 },
  { id: 'image-prepare-1MiB', operation: 'image-prepare', imageBytes: 1024 ** 2 },
  { id: 'save-image-1MiB', operation: 'save-image', imageBytes: 1024 ** 2 },
  { id: 'reopen-image-1MiB', operation: 'reopen', imageBytes: 1024 ** 2, storedImage: true },
  { id: 'image-prepare-5MiB', operation: 'image-prepare', imageBytes: 5 * 1024 ** 2 },
  { id: 'save-image-5MiB', operation: 'save-image', imageBytes: 5 * 1024 ** 2 },
  { id: 'reopen-image-5MiB', operation: 'reopen', imageBytes: 5 * 1024 ** 2, storedImage: true },
  ...[27, 33, 60, 600].flatMap(history => ['reopen', 'save', 'discovery'].map(operation => ({ id: `${operation}-history-${history}`, operation, history }))),
  { id: 'pr-prepare', operation: 'pr-prepare' }, { id: 'pr-create', operation: 'pr-create' },
  { id: 'pr-status', operation: 'pr-status' }, { id: 'pr-create-history-600', operation: 'pr-create', history: 600 },
  ...[1, 5].flatMap(mib => ['pr-prepare', 'pr-create'].map(operation => ({ id: `${operation}-image-${mib}MiB`, operation, imageBytes: mib * 1024 ** 2, storedImage: true }))),
  { id: 'pr-create-repeat', operation: 'pr-create', attempts: 1 },
  { id: 'pr-create-attempts-20', operation: 'pr-create', attempts: 20, closeAttempts: true },
  { id: 'pr-status-attempts-20', operation: 'pr-status', attempts: 20 },
  { id: 'pr-prepare-128KiB', operation: 'pr-prepare', documentChars: 128 * 1024 },
  { id: 'pr-create-128KiB', operation: 'pr-create', documentChars: 128 * 1024 },
  { id: 'repeat-save', operation: 'repeat-save' },
];
// Valid RGBA PNGs, generated only in memory. Ancillary tEXt padding gives exact
// reproducible byte sizes; dimensions/bytes are recorded, no test assets tracked.
function png(size) {
  const dimension = size > 2 * 1024 ** 2 ? 1000 : 500;
  const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let j=0;j<8;j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const value = Buffer.concat([Buffer.from(type), data]), out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); value.copy(out, 4); out.writeUInt32BE(crc32(value), out.length - 4); return out; };
  const header = Buffer.alloc(13); header.writeUInt32BE(dimension); header.writeUInt32BE(dimension,4); header[8]=8; header[9]=6;
  const raw = Buffer.alloc(dimension * (dimension * 4 + 1)); let seed = 123456789;
  for(let row=0;row<dimension;row++)for(let col=1;col<=dimension*4;col++){seed ^= seed<<13;seed ^= seed>>>17;seed ^= seed<<5;raw[row*(dimension*4+1)+col]=seed&255;}
  const chunks = [Buffer.from('89504e470d0a1a0a','hex'), chunk('IHDR',header), chunk('IDAT',deflateSync(raw,{level:0}))];
  const padding = size - chunks.reduce((sum,c)=>sum+c.length,0) - 12 - 12;
  if(padding<4)throw Error('PNG fixture size too small');
  const text = Buffer.alloc(padding,120);Buffer.from('Q\0').copy(text);
  chunks.push(chunk('tEXt',text),chunk('IEND',Buffer.alloc(0)));
  const bytes=Buffer.concat(chunks);if(bytes.length!==size)throw Error('PNG size mismatch');return bytes;
}
function serialize(repo) { return { refs:[...repo.refs], commits:[...repo.commits], trees:[...repo.trees].map(([key,value])=>[key,[...value]]), objects:[...repo.objects].map(([key,value])=>[key,Buffer.from(value).toString('base64')]), pulls:repo.pulls }; }
async function hydrate(graph) {
  const repo=await draftTestRepository();
  for(const key of ['refs','commits','trees','objects'])repo[key].clear();
  for(const [key,value]of graph.refs)repo.refs.set(key,value);
  for(const [key,value]of graph.commits)repo.commits.set(key,value);
  for(const [key,value]of graph.trees)repo.trees.set(key,new Map(value));
  for(const [key,value]of graph.objects)repo.objects.set(key,new Uint8Array(Buffer.from(value,'base64')));
  repo.pulls=structuredClone(graph.pulls);return repo;
}
async function fixture(spec) {
  const initial = Object.fromEntries(Array.from({length:168},(_,i)=>[`src/content/docs/guides/extra-${i}.mdx`,`---\ntitle: Extra ${i}\n---\n\nPublished paragraph.`]));
  initial[path]='---\ntitle: Qualification\ndraft: false\n---\n\nOriginal.';
  const repo=await draftTestRepository(initial), store=()=>createDraftStore({request:repo.request});
  const opened=await store().getContent(area,filename);
  let saved=await savePage(store(),area,filename,{...opened,...parsePage(opened.content),body:body(spec.documentChars||1024)});
  for(let i=0;i<2;i++)await savePage(store(),area,`other-${i}.mdx`,{title:`Other ${i}`,description:'',body:'Unpublished.'});
  for(let i=0;i<(spec.history||0);i++)saved={...saved,head:await repo.put(path,saved.content+`\nHistory ${i}.`,{branch:saved.branch})};
  if(spec.history)saved={...await store().getContent(area,filename)};
  let asset;
  if(spec.imageBytes){const image=await prepareDraftImage({area,documentFilename:filename,filename:'qualification.png',mimeType:'image/png',bytes:png(spec.imageBytes)});asset={...image,filename:'qualification.png',mimeType:'image/png'};}
  if(spec.storedImage)saved=await savePage(store(),area,filename,{...saved,...parsePage(saved.content),body:`![Qualification](@images/${asset.path})`,assets:[asset]});
  const publishInput={area,filename,head:saved.head};
  if(['pr-status','repeat-save'].includes(spec.operation)||spec.attempts){
    const candidate=preparePublicationCandidate(await store().preparePublication(publishInput),filename);
    for(let i=0;i<(spec.attempts||1);i++){
      await store().publishContent({...publishInput,candidate});
      if(spec.closeAttempts||i<(spec.attempts||1)-1)repo.pulls.at(-1).state='closed';
    }
    if(spec.operation==='repeat-save'){
      const pr=repo.pulls[0], file=repo.filesAt(pr.head.sha).get(path);
      pr.merge_commit_sha=await repo.put(path,new TextDecoder().decode(repo.objects.get(file.sha)));pr.merged_at='2026-11-19T12:00:00Z';pr.state='closed';
      saved=await store().getContent(area,filename);
    }
  }
  let url=contentURL,method='GET',input;
  if(['save','repeat-save','save-image'].includes(spec.operation)){
    method='PUT';input={...saved,...parsePage(saved.content),body:parsePage(saved.content).body+'\n\nNext edit.'};
    if(spec.operation==='save-image'){input.body+=`\n\n![Qualification](@images/${asset.path})`;input.assets=[asset];}
  }
  if(spec.operation==='discovery')url=`/api/content/${area}`;
  if(spec.operation==='image-prepare'){url='/api/images';method='POST';input={area,documentFilename:filename,...asset};}
  if(spec.operation.startsWith('pr-')){url=publishURL;if(spec.operation!=='pr-status'){method='POST';input={head:saved.head};if(spec.operation==='pr-prepare')input.prepare=true;else input.candidate=preparePublicationCandidate({content:saved.content,assets:JSON.parse(repo.commits.get(saved.head).message.split('CMS-Draft-v1: ')[1]).assets},filename);}}
  const payload=input?JSON.stringify(input):undefined;
  return {spec:{...spec,otherPublishedDocuments:168,otherDrafts:2,selectedDocumentChars:saved.content.length,bodyBytes:payload?Buffer.byteLength(payload):0},graph:serialize(repo),url,method,payload};
}
async function sample(data, label, index) {
  const repo=await hydrate(data.graph);let calls=[],mockCpuUs=0,additionalExternalFetches=0;
  const env={EDITOR_ORIGIN:origin,GITHUB_CLIENT_ID:'qualification-only',GITHUB_CLIENT_SECRET:'not-a-live-secret',SESSION_SECRET:'local-qualification-only-session-secret',ALLOWED_GITHUB_USERS:'qualification',CMS_PUBLISH_ENABLED:'true'};
  globalThis.fetch=async(url,options={})=>{
    const value=new URL(String(url));
    if(value.origin==='https://github.com'&&value.pathname==='/login/oauth/access_token'){additionalExternalFetches++;return Response.json({access_token:'in-memory-only'});}
    if(value.origin!=='https://api.github.com')throw Error('NETWORK DISABLED: unexpected fetch target');
    const graphQuery=value.pathname==='/graphql'?JSON.parse(options.body).query:null;
    const query=graphQuery?.match(/(?:query|mutation)\s+(\w+)/)?.[1];
    calls.push({method:options.method||'GET',path:query||value.pathname.replace('/repos/geobtaa/geobtaa.github.io','')});
    if(value.pathname==='/user')return Response.json({login:'qualification'});
    const start=process.cpuUsage();
    try{
      // The generic test model supplies Blob.text even for oid-only queries.
      // Match GitHub's selected fields here so mock image decoding/transfer does
      // not masquerade as CPU work in the real publication handler.
      if(query==='CMSPublicationFiles'&&!graphQuery.includes('text isTruncated')){
        const repository={};
        for(const [,alias,encoded]of graphQuery.matchAll(/(b\d+): object\(expression:("(?:[^"\\]|\\.)*")/g)){
          const expression=JSON.parse(encoded),colon=expression.indexOf(':');
          const file=repo.filesAt(expression.slice(0,colon)).get(expression.slice(colon+1));
          repository[alias]=file?{oid:file.sha}:null;
        }
        return Response.json({data:{repository}});
      }
      return await repo.fetchImpl(url,options);
    }finally{const used=process.cpuUsage(start);mockCpuUs+=used.user+used.system;}
  };
  const login=await onRequest({request:new Request(origin+'/api/auth/login'),env});
  const state=new URL(login.headers.get('location')).searchParams.get('state');
  const callback=await onRequest({request:new Request(origin+`/api/auth/callback?code=fixture&state=${state}`,{headers:{Cookie:login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')}}),env});
  if(callback.status!==302)throw Error('Fixture login failed');
  const cookie=callback.headers.getSetCookie().find(v=>v.startsWith('editor_session=')).split(';')[0];
  calls=[];mockCpuUs=0;additionalExternalFetches=0;
  const req=new Request(origin+data.url,{method:data.method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:data.payload});
  const cpu=process.cpuUsage(),wall=performance.now();
  const response=await onRequest({request:req,env});
  const result=await response.json();
  const used=process.cpuUsage(cpu);
  const groupPath = path => path.replace(/\b[a-f0-9]{40}\b/g, ':oid');
  const grouped={};for(const c of calls){const key=groupPath(c.path);grouped[key]=(grouped[key]||0)+1;}
  const totalExternalFetches=calls.length+additionalExternalFetches;
  return {label,index,httpStatus:response.status,logicalExternalFetches:totalExternalFetches,githubApiFetches:calls.length,additionalExternalFetches,totalExternalFetches,nodeProcessCpuMs:+((used.user+used.system)/1000).toFixed(3),mockTransportCpuMs:+(mockCpuUs/1000).toFixed(3),localWallMs:+(performance.now()-wall).toFixed(3),error:result.error||null,resultState:result.state||null,requestBudgetExceeded:totalExternalFetches>50,firstFetchBeyond50:calls[50]||null,grouped};
}
if(process.argv[2]==='--child'){
  const data=JSON.parse(await readFile(process.argv[3],'utf8')),samples=[];
  samples.push(await sample(data,'fresh-node-process',0));
  for(let i=1;i<=Number(process.argv[4]);i++)samples.push(await sample(data,'same-process-warm',i));
  process.stdout.write(JSON.stringify(samples));
}else{
  const outputIndex=process.argv.indexOf('--output'),filterIndex=process.argv.indexOf('--filter'),warmIndex=process.argv.indexOf('--warm');
  const warm=warmIndex<0?2:Number(process.argv[warmIndex+1]);if(!Number.isInteger(warm)||warm<1||warm>20)throw Error('--warm must be 1..20');
  const selected=scenarios.filter(s=>filterIndex<0||new RegExp(process.argv[filterIndex+1]).test(s.id));
  if(!selected.length)throw Error('No matching scenarios');
  const directory=await mkdtemp(join(tmpdir(),'cms-free-qualification-'));
  const report={schema:1,revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:`${process.platform}/${process.arch}`,measuredAt:new Date().toISOString(),actualCloudflareMeasurements:false,network:'disabled; in-memory GitHub only',cpuMeaning:'Node process CPU including mock transport; not Cloudflare CPU. Module initialization and fixture/session setup excluded. Fresh means fresh compiler/route module caches, not an observed Cloudflare cold isolate.',cases:[]};
  report.trackedChanges=execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  report.sourceSha256={};
  for(const path of ['functions/api/[[path]].js','editor-prototype/draftStorage.mjs','editor-prototype/publicationPolicy.mjs','editor-prototype/draftTestRepository.mjs','scripts/qualify-cms-free.mjs'])report.sourceSha256[path]=Buffer.from(await crypto.subtle.digest('SHA-256',await readFile(path))).toString('hex');
  try{for(const spec of selected){process.stderr.write(`Measuring ${spec.id}\n`);const data=await fixture(spec),file=join(directory,'case.json');await writeFile(file,JSON.stringify(data));const child=spawnSync(process.execPath,[self,'--child',file,String(warm)],{encoding:'utf8',maxBuffer:8_000_000});if(child.status!==0)throw Error(child.stderr||child.stdout);report.cases.push({fixture:data.spec,url:data.url,method:data.method,samples:JSON.parse(child.stdout)});}}
  finally{await rm(directory,{recursive:true,force:true});}
  const text=JSON.stringify(report,null,2)+'\n';
  if(outputIndex>=0)await writeFile(process.argv[outputIndex+1],text);else process.stdout.write(text);
}
