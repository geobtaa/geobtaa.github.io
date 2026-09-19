export type BodySegment = { id: number; kind: 'markdown' | 'protected'; content: string };

export function splitBody(body: string): BodySegment[] {
  const lines = body.match(/[^\n]*\n|[^\n]+$/g) || [];
  const segments: BodySegment[] = [];
  let markdown = '';
  const push = (kind: BodySegment['kind'], content: string) => {
    if (!content) return;
    const previous = segments.at(-1);
    if (previous?.kind === kind) previous.content += content;
    else segments.push({ id: segments.length, kind, content });
  };
  const flushMarkdown = () => { push('markdown', markdown); markdown = ''; };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (/^\s*(import|export)\s/.test(line)) {
      flushMarkdown(); push('protected', line); index += 1; continue;
    }
    if (/^\s*:::/.test(line)) {
      flushMarkdown(); let block = line; index += 1;
      while (index < lines.length) { block += lines[index]; if (/^\s*:::\s*$/.test(lines[index])) { index += 1; break; } index += 1; }
      push('protected', block); continue;
    }
    if (/^\s*\{/.test(line)) {
      flushMarkdown(); let block = line; index += 1;
      let depth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      while (index < lines.length && depth > 0) {
        block += lines[index];
        depth += (lines[index].match(/\{/g) || []).length - (lines[index].match(/\}/g) || []).length;
        index += 1;
      }
      push('protected', block); continue;
    }
    const tag = line.match(/<([A-Za-z][\w.-]*)\b/);
    if (tag && (/^\s*</.test(line) || /^[A-Z]/.test(tag[1]))) {
      flushMarkdown(); let block = line; index += 1;
      const closing = new RegExp(`</${tag[1]}\\s*>`);
      if (!line.includes('/>') && !closing.test(line)) {
        const startsBlock = line.includes('>');
        while (index < lines.length) {
          block += lines[index];
          const done = startsBlock ? closing.test(lines[index]) : lines[index].includes('/>');
          index += 1;
          if (done) break;
        }
      }
      push('protected', block); continue;
    }
    markdown += line; index += 1;
  }
  flushMarkdown();
  return segments.length ? segments : [{ id: 0, kind: 'markdown', content: '' }];
}
