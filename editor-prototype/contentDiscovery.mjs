import { CONTENT_ROOT, contentDirectory, contentArea, validateContentPath } from './contentAreas.mjs';
import { draftBranch, draftMetadata } from './draftIdentity.mjs';
const oid = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const unavailable = message => Object.assign(new Error(message), { status: 503 });

// A catalog of repository objects, never authority for editing, routes or PRs.
export async function discoverContent({ request, owner, repo }, area) {
  const directory = contentDirectory(area), prefix = directory + '/';
  const query = async (query, variables = {}) => {
    const result = await request('/graphql', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({query,variables:{owner,repo,...variables}}) });
    if (result.errors?.some(error => ['FORBIDDEN','UNAUTHORIZED'].includes(error.type))) throw Object.assign(new Error('GitHub denied content discovery. Check your sign-in and repository access.'),{status:403});
    if (result.errors?.length || !result.data?.repository) throw unavailable('Content discovery is incomplete. Refresh the list; saved work is unchanged.');
    return result.data.repository;
  };
  const candidates = [], cursors = new Set(); let after = null, mainHead, count = 0, uncertain = false;
  do {
    const result = await query('query CMSContentDiscovery($owner:String!,$repo:String!,$after:String){repository(owner:$owner,name:$repo){ref(qualifiedName:"refs/heads/main"){target{oid}} refs(refPrefix:"refs/heads/cms/drafts/",first:100,after:$after){nodes{name prefix target{oid ...on Commit{message}}} pageInfo{hasNextPage endCursor}}}}',{after});
    mainHead ||= result.ref?.target?.oid;
    if (!oid(mainHead)) throw unavailable('The main content baseline is unavailable.');
    const page = result.refs;
    if (!Array.isArray(page?.nodes) || typeof page.pageInfo?.hasNextPage !== 'boolean') throw unavailable('Saved-work discovery is incomplete. Refresh before relying on list indicators.');
    for (const item of page.nodes) {
      count++;
      try {
        if (item?.prefix !== 'refs/heads/cms/drafts/' || typeof item.name !== 'string' || !item.name || !oid(item.target?.oid)) throw new Error();
        const meta = draftMetadata(item.target);
        if (![1,2].includes(meta.version) || typeof meta.path !== 'string' || !meta.path.startsWith(CONTENT_ROOT+'/')) throw new Error();
        const [candidateArea,...parts] = meta.path.slice(CONTENT_ROOT.length+1).split('/'), filename = parts.join('/');
        if (!contentArea(candidateArea) || validateContentPath(filename) !== filename || filename.split('/').at(-1).startsWith('_') || await draftBranch(candidateArea,filename,meta) !== 'cms/drafts/'+item.name) throw new Error();
        if (candidateArea === area) candidates.push({path:meta.path,name:filename,head:item.target.oid,retired:!!meta.retiredTo});
      } catch { uncertain = true; }
    }
    if (!page.pageInfo.hasNextPage) break;
    const cursor = page.pageInfo.endCursor;
    if (typeof cursor !== 'string' || !cursor || cursors.has(cursor) || count >= 5000) throw unavailable('Saved-work inventory is incomplete. Refresh or ask a maintainer; no work was changed.');
    cursors.add(cursor); after = cursor;
  } while (true);

  // Every expression is pinned to an immutable OID, not a second read of main.
  const entries = new Map(), groups = new Map();
  for (const candidate of candidates) {
    if (!groups.has(candidate.path)) groups.set(candidate.path,[]);
    groups.get(candidate.path).push(candidate);
  }
  let tasks = [{kind:'tree',head:mainHead,path:directory,name:''}, ...candidates.map(candidate=>({kind:'blob',...candidate}))];
  let visited = 0;
  while (tasks.length) {
    const batch = tasks.splice(0,24);
    if ((visited += batch.length) > 10000) throw unavailable('Content inventory is too large for complete discovery. Ask a maintainer.');
    const fields = batch.map((task,i)=>`o${i}:object(expression:${JSON.stringify(task.head+':'+task.path)}){${task.kind==='tree'?'...on Tree{oid entries{name oid type mode}}':'...on Blob{oid}'}}`).join(' ');
    const data = await query(`query CMSContentObjects($owner:String!,$repo:String!){repository(owner:$owner,name:$repo){${fields}}}`);
    for (const [i,task] of batch.entries()) {
      const value = data['o'+i];
      if (task.kind === 'blob') { task.exists = oid(value?.oid); if (!task.exists) uncertain = true; continue; }
      if (value === null && task.path === directory) continue; // An enabled area can contain only new drafts.
      if (!oid(value?.oid) || !Array.isArray(value.entries)) throw unavailable('The content-area tree is incomplete.');
      const names = new Set();
      for (const file of value.entries) {
        if (typeof file?.name !== 'string' || !file.name || /[\/\\]/.test(file.name) || ['.','..'].includes(file.name) || names.has(file.name) || !oid(file.oid)) throw unavailable('Invalid content-area inventory.');
        names.add(file.name);
        const name = task.name + file.name, path = prefix + name;
        if (file.type === 'tree' && file.mode === 16384) tasks.push({kind:'tree',head:mainHead,path,name:name+'/'});
        else if (/\.mdx?$/.test(name) && !file.name.startsWith('_')) {
          try { if (validateContentPath(name) !== name) throw new Error(); }
          catch { uncertain = true; continue; }
          entries.set(path,{name,path,onMain:true,mainBlob:file.oid,baselineExists:true,visibilityKnown:false,discovery:'provisional',draftHint:'none-observed',needsReview:file.type!=='blob'||file.mode!==33188});
        }
      }
    }
    // Keep only file-existence evidence; it never chooses the current generation.
    for (const task of batch.filter(task=>task.kind==='blob')) {
      const candidate = candidates.find(c=>c.head===task.head&&c.path===task.path);
      if (candidate) candidate.exists = task.exists;
    }
  }
  for (const [path,versions] of groups) {
    const active = versions.filter(v=>!v.retired), found = versions.some(v=>v.exists);
    if (!entries.has(path) && found) entries.set(path,{name:versions[0].name,path,onMain:false,baselineExists:false,visibilityKnown:false,discovery:'provisional'});
    const row = entries.get(path);
    if (row) { row.draftHint = active.length===1&&active[0].exists?'saved':'review'; row.candidateHeads=versions.map(v=>v.head).sort(); }
  }
  if (uncertain) for (const row of entries.values()) if (row.draftHint==='none-observed') row.draftHint='unknown';
  return {branch:'main',mainHead,discovery:'provisional',complete:!uncertain,warnings:uncertain?['Some saved-work indicators could not be identified. Open a document to check its editing state.']:[],entries:[...entries.values()]};
}
