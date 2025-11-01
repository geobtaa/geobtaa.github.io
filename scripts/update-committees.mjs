import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blogDir = path.resolve(__dirname, '../src/content/docs/blog');

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

function normaliseLines(block) {
  return block
    .split(/\r?\n+/)
    .map((line) => line.replace(/^[\s]*[-*]\s?/, '').trim())
    .filter(Boolean);
}

function transformCommitteesSection(source) {
  const pattern =
    /### Committees\s*\n<div class="grid" markdown>\s*\n([\s\S]*?)<\/div>/m;

  return source.replace(pattern, (match, inner) => {
    const cardRegex = /===\s*"([^"]+)"\s*\n([\s\S]*?)(?=(?:\n===\s*"|$))/g;
    const cards = [];

    let cardMatch;
    while ((cardMatch = cardRegex.exec(inner)) !== null) {
      const title = cardMatch[1].trim();
      const body = normaliseLines(cardMatch[2]);

      if (!title || body.length === 0) continue;

      let contents;
      if (body.length === 1) {
        contents = `    ${body[0]}`;
      } else {
        contents = body.map((line) => `    - ${line}`).join('\n');
      }

      cards.push(
        `  <Card title="${title}">\n${contents}\n  </Card>`
      );
    }

    if (cards.length === 0) {
      // No transformation if nothing parsed
      return match;
    }

    return `### Committees\n\n<CardGrid>\n${cards.join('\n\n')}\n</CardGrid>`;
  });
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf-8');
  const updated = transformCommitteesSection(original);

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf-8');
    console.log(`Updated committees section in ${path.relative(process.cwd(), filePath)}`);
  }
}

const files = collectBlogFiles(blogDir);
files.forEach(processFile);
