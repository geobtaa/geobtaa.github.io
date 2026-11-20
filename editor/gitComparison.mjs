// Status and merge-base describe the whole pair; later pages omit file patches.
export async function compareAncestry(request, base, head) {
  const oid = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
  const invalid = () => Object.assign(new Error('GitHub ancestry evidence is incomplete or inconsistent. Nothing can be confirmed; keep your edits.'), { status: 503 });
  if (!oid(base) || !oid(head)) throw invalid();
  if (base === head) return { status: 'identical', merge_base_commit: { sha: base } };
  const result = await request(`/compare/${base}...${head}?per_page=1&page=2`);
  if (!result || !['ahead','behind','diverged'].includes(result.status) || !oid(result.merge_base_commit?.sha)) throw invalid();
  if (result.status === 'ahead' && result.merge_base_commit.sha !== base || result.status === 'behind' && result.merge_base_commit.sha !== head) throw invalid();
  return result;
}
