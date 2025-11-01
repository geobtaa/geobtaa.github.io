import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blogDir = path.resolve(__dirname, '../src/content/docs/blog');

function collectMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function convertAdmonitions(source) {
  const lines = source.split(/\r?\n/);
  const output = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (!line.startsWith('!!!')) {
      output.push(line);
      continue;
    }

    const match = line.match(/^!!!\s+([^\s"]+)(?:[^"]*"([^"]*)")?/);
    if (!match) {
      output.push(line);
      continue;
    }

    const type = match[1].toLowerCase();
    const title = match[2]?.trim();

    const bodyLines = [];
    let j = i + 1;

    while (j < lines.length) {
      const next = lines[j];

      if (next.trim() === '') {
        bodyLines.push('');
        j += 1;
        continue;
      }

      if (/^\s/.test(next)) {
        bodyLines.push(next.replace(/^\s+/, ''));
        j += 1;
        continue;
      }

      break;
    }

    if (bodyLines.length === 0) {
      output.push(line);
      continue;
    }

    const header = title ? `:::${type}[${title}]` : `:::${type}`;
    output.push(header);
    output.push(...bodyLines);
    output.push(':::');

    i = j - 1;
  }

  return output.join('\n');
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf-8');
  const transformed = convertAdmonitions(original);

  if (transformed !== original) {
    fs.writeFileSync(filePath, transformed, 'utf-8');
    console.log(`Converted admonitions in ${path.relative(process.cwd(), filePath)}`);
  }
}

collectMarkdownFiles(blogDir).forEach(processFile);
