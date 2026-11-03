export function ensureStarlightImport(source: string, component: string, binding = component) {
  // Ignore imports shown in code examples, preserving offsets into the original source.
  let fence = '';
  const importSource = (source.match(/[^\n]*\n|[^\n]+$/g) || []).map((line) => {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*(?:\\r?\\n)?$`).test(line)) fence = '';
      return line.replace(/[^\r\n]/g, ' ');
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (opening) { fence = opening[1]; return line.replace(/[^\r\n]/g, ' '); }
    return line;
  }).join('');
  // Match complete import statements, including multiline bindings. Leave them verbatim.
  const imports = [...importSource.matchAll(/^[ \t]*import\s+(?:(['"])[^'"\r\n]+\1|[\s\S]*?\bfrom\s*(['"])[^'"\r\n]+\2)[ \t]*;?[ \t]*(?:\r?\n|$)/gm)];
  if (imports.some(([statement]) => {
    if (/^\s*import\s+type\b/.test(statement)) return false;
    const bindings = statement.match(/\{([^}]*)\}\s*from\s*['"]@astrojs\/starlight\/components['"]/);
    return bindings?.[1].split(',').some((named) => new RegExp(`^${component}${binding === component ? `(?:\\s+as\\s+${binding})?` : `\\s+as\\s+${binding}`}$`).test(named.trim()));
  })) return { content: source, added: false };
  const conflict = imports.some(([statement]) => {
    if (new RegExp(`^\\s*import\\s+${binding}(?:\\s|,)`).test(statement) || new RegExp(`\\*\\s+as\\s+${binding}\\b`).test(statement)) return true;
    return statement.match(/\{([^}]*)\}/)?.[1].split(',').some((named) => new RegExp(`^(?:${binding}|\\w+\\s+as\\s+${binding})$`).test(named.trim()));
  }) || new RegExp(`^\\s*export\\s+(?:const|let|var|function|class)\\s+${binding}\\b`, 'm').test(importSource);
  if (conflict) return { content: source, added: false, error: `This page already uses the name ${binding} for another import or definition. Rename it in GitHub before inserting this component.` };
  const declaration = `import { ${component}${component === binding ? '' : ` as ${binding}`} } from '@astrojs/starlight/components';`;
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const last = imports.at(-1);
  const offset = last ? last.index! + last[0].length : 0;
  const before = source.slice(0, offset);
  return { content: `${before}${before && !before.endsWith('\n') ? newline : ''}${declaration}${newline}${offset ? '' : newline}${source.slice(offset)}`, added: true };
}
