// Current trusted main requires its browser command to use this directory.
// Run the complete relocated suite; remove this bridge after the CI migration.
import { readdir } from 'node:fs/promises';
const directory = new URL('../editor/', import.meta.url);
for (const filename of (await readdir(directory)).filter(name => name.endsWith('.browser.mjs')).sort()) {
  await import(new URL(filename, directory));
}
