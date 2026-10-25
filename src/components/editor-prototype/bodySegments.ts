import { parseSimpleComponentMdx } from './simpleComponents.ts';
import { matchLinkButtonBlock, parseLinkButtonMdx } from './linkButtonMdx.ts';
import { matchLinkCardBlock, parseLinkCardMdx } from './linkCardMdx.ts';

export type BodySegment = { id: number; kind: 'markdown' | 'protected' | 'structured'; content: string };

export function splitBody(body: string): BodySegment[] {
  const lines = body.match(/[^\n]*\n|[^\n]+$/g) || [];
  const segments: BodySegment[] = [];
  let markdown = '';
  const push = (kind: BodySegment['kind'], content: string) => {
    if (!content) return;
    const previous = segments.at(-1);
    if (kind !== 'structured' && previous?.kind === kind) previous.content += content;
    else segments.push({ id: segments.length, kind, content });
  };
  const flushMarkdown = () => { push('markdown', markdown); markdown = ''; };

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      markdown += line; index += 1;
      const closing = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*(?:\\r?\\n)?$`);
      while (index < lines.length) {
        const next = lines[index++]; markdown += next;
        if (closing.test(next)) break;
      }
      continue;
    }
    if (/^\s*(import|export)\s/.test(line)) {
      flushMarkdown(); let block = line; index += 1;
      // Multiline imports must not expose the imported names as Markdown.
      if (/^\s*import\b/.test(line) && !/\bfrom\s*['"]|^\s*import\s*['"]/.test(line)) {
        while (index < lines.length) {
          const next = lines[index++]; block += next;
          if (/\bfrom\s*['"]/.test(next)) break;
        }
      }
      push('protected', block); continue;
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
    if (/^\s*<LinkCard\b/.test(line)) {
      let block = line; index += 1;
      while (!block.includes('/>') && index < lines.length) { block += lines[index]; index += 1; }
      flushMarkdown();
      if (matchLinkCardBlock(block) === block && parseLinkCardMdx(block)) push('structured', block);
      else push('protected', block);
      continue;
    }
    const tag = line.match(/<([A-Za-z][\w.-]*)\b/);
    if (tag && (/^\s*</.test(line) || /^[A-Z]/.test(tag[1]))) {
      flushMarkdown(); let block = line; index += 1;
      const name = tag[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const tags = new RegExp(`<(/?)${name}(?=[\\s/>])(?:[^>"']|"[^"]*"|'[^']*')*>`, 'g');
      const complete = () => {
        const matches = [...block.matchAll(tags)];
        if (!matches.length) return false;
        let depth = 0;
        for (const match of matches) depth += match[1] ? -1 : /\/\s*>$/.test(match[0]) ? 0 : 1;
        return depth === 0;
      };
      while (!complete() && index < lines.length) {
        block += lines[index++];
      }
      if (parseSimpleComponentMdx(block) || (tag[1] === 'LinkButton' && matchLinkButtonBlock(block) === block && parseLinkButtonMdx(block))) push('structured', block);
      else push('protected', block);
      continue;
    }
    markdown += line; index += 1;
  }
  flushMarkdown();
  return segments.length ? segments : [{ id: 0, kind: 'markdown', content: '' }];
}
