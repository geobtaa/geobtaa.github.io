import { createMarkdownProcessor } from '@astrojs/markdown-remark';

let processorPromise: Promise<Awaited<ReturnType<typeof createMarkdownProcessor>>> | null = null;

const getProcessor = () => {
  if (!processorPromise) {
    processorPromise = createMarkdownProcessor();
  }
  return processorPromise;
};

export async function renderMarkdown(markdown: string): Promise<string> {
  const input = typeof markdown === 'string' ? markdown.trim() : '';
  if (!input) return '';

  const processor = await getProcessor();
  const result = await processor.render(input);
  return result.code ?? '';
}
