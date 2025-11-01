import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blogDir = path.resolve(__dirname, '../src/content/docs/blog');
const layoutLine = ``;
const importLine = `import TwoThirdsLayout from 'src/components/TwoThirdsLayout.astro';
import ChipList from 'src/components/ChipList.astro';
import { Card, CardGrid } from '@astrojs/starlight/components';`;

function collectBlogFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectBlogFiles(fullPath));
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function ensureLayout(frontMatter) {
  if (frontMatter.includes(`\n${layoutLine}\n`)) {
    return frontMatter;
  }

  const lines = frontMatter.trim().split(/\r?\n/);
  // Insert layout after the title line if possible, otherwise after the opening triple dash.
  let inserted = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('title:')) {
      lines.splice(i + 1, 0, layoutLine);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    lines.splice(1, 0, layoutLine);
  }

  return `${lines.join('\n')}\n`;
}

function ensureImport(body) {
  if (body.includes(importLine)) {
    return body;
  }

  return `${importLine}\n\n${body.trimStart()}`;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf-8');
  const match = original.match(/^---\s*[\r\n]+([\s\S]*?)\r?\n---\s*/);

  if (!match) {
    return;
  }

  const frontMatter = match[1];
  const bodyStart = match[0].length;
  const body = original.slice(bodyStart);

  const updatedFrontMatter = ensureLayout(frontMatter);
  const updatedBody = ensureImport(body);

  const updated = `---\n${updatedFrontMatter}---\n${updatedBody}`;

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf-8');
    console.log(`Inserted layout/import into ${path.relative(process.cwd(), filePath)}`);
  }
}

const files = collectBlogFiles(blogDir);
files.forEach(processFile);
