// Local read-only latency profiling. Never loads Cloudflare secrets or writes GitHub.
import {onRequest} from '../functions/api/[[path]].js';
import {writeFile} from 'node:fs/promises';
if (!process.env.GITHUB_TOKEN) throw new Error('Provide the existing GitHub token through the environment; all writes remain blocked.');
const origin='https://gin-editor.pages.dev',secret='read-only-local-profiling-session-secret-not-live';
const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify({token:process.env.GITHUB_TOKEN,login:'read-only-local-profile',exp:Date.now()+3600000})));const cookie=`editor_session=${Buffer.from(iv).toString('base64url')}.${Buffer.from(cipher).toString('base64url')}`;
const original=globalThis.fetch;let trace=[],start;
globalThis.fetch=async(input,options={})=>{
 const url=new URL(String(input)),body=options.body?JSON.parse(options.body):null,method=options.method||'GET';
 if(url.origin!=='https://api.github.com'||!(method==='GET'||url.pathname==='/graphql'&&method==='POST'&&/^query\b/.test(body?.query||'')))throw Error('Read-only profiling blocked an outbound write/target');
 const row={label:body?.query.match(/query\s+(\w+)/)?.[1]||url.pathname.replace('/repos/geobtaa/geobtaa.github.io',''),method,startMs:performance.now()-start};trace.push(row);const at=performance.now();
 const response=await original(input,{...options,redirect:'manual'});row.headersMs=performance.now()-at;const bytes=await response.arrayBuffer();row.totalMs=performance.now()-at;row.status=response.status;row.bytes=bytes.byteLength;
 return new Response(bytes,{status:response.status,headers:response.headers});
};
const result={kind:'local Pages handler with real GitHub read-only requests; NOT Cloudflare or editor browser telemetry',cases:[]};
for(let round=1;round<=2;round++)for(const path of ['/api/content/library','/api/content/library/cms-publishing-test.mdx','/api/content/library/geodata-pilot-workgroup-report.mdx']){
 trace=[];start=performance.now();const cpu=process.cpuUsage();const response=await onRequest({request:new Request(origin+path,{headers:{Cookie:cookie}}),env:{EDITOR_ORIGIN:origin,SESSION_SECRET:secret,ALLOWED_GITHUB_USERS:'read-only-local-profile'}});const text=await response.text();const used=process.cpuUsage(cpu),entry={round,path,status:response.status,wallMs:performance.now()-start,nodeCpuMs:(used.user+used.system)/1000,responseBytes:Buffer.byteLength(text),calls:trace,entries:JSON.parse(text).entries?.length,error:JSON.parse(text).error};result.cases.push(entry);console.log(JSON.stringify({...entry,calls:trace.length,githubBytes:trace.reduce((s,r)=>s+r.bytes,0),githubWallMs:trace.reduce((s,r)=>s+r.totalMs,0)}));
}
await writeFile(process.argv[2] || '/tmp/cms-read-profile-results.json',JSON.stringify(result,null,2));
