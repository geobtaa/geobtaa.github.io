import { parseDocument } from 'yaml';
import { newBlog, serializeBlog, todayCalendar } from './blog.mjs';
import { parsePage } from './page.mjs';
import { patchFrontmatter } from './pageMetadata.mjs';
import { contentVisibility } from './content.mjs';
import { splitBody } from '../src/components/editor-prototype/bodySegments.ts';

export const PROGRAM_UPDATE_OUTLINE = `## Monthly Highlight

## Program Activities

### Committees

### Workgroups

## BTAA Geoportal

### This month by the numbers

### Top Google searches

### Top internal searches

## Collections

### Harvesting Activities

## Web Development
`;

const invalid = (message) => Object.assign(new Error(message), { status: 400 });
const text = (value) => typeof value === 'string' ? value.trim() : '';
const narrative = (value) => Array.isArray(value) ? value.map((item) => `- ${item}`).join('\n') : text(value);
const literal = (value) => String(value ?? '').replace(/[\\`*_[\]<>#{}]/g, '\\$&').replace(/\r?\n/g, ' ');
const link = (label, url) => `[${literal(label || url)}](<${String(url).trim().replace(/[<>\r\n]/g, (char) => encodeURIComponent(char))}>)`;
const image = (src, alt, caption) => `![${literal(alt)}](<${text(src).replace(/[<>\r\n]/g, (char) => encodeURIComponent(char))}>)${caption ? `\n\n*${literal(caption)}*` : ''}`;
const section = (heading, body, level = 2) => body.trim() ? `${'#'.repeat(level)} ${heading}\n\n${body.trim()}\n\n` : '';
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br />');

// Reject unfamiliar data rather than silently dropping it during conversion.
function checkObject(value, fields, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid(`${path} has an unsupported format.`);
  for (const [key, entry] of Object.entries(value)) {
    if (!Object.hasOwn(fields, key)) throw invalid(`${path}.${key} needs manual review before conversion.`);
    fields[key](entry, `${path}.${key}`);
  }
}
const string = (value, path) => { if (typeof value !== 'string') throw invalid(`${path} must be text before conversion.`); };
const listOf = (check) => (value, path) => {
  if (!Array.isArray(value)) throw invalid(`${path} must be a list before conversion.`);
  value.forEach((entry, index) => check(entry, `${path}[${index}]`));
};
const rich = (value, path) => Array.isArray(value) ? listOf(string)(value, path) : string(value, path);
const objectOf = (fields) => (value, path) => checkObject(value, fields, path);

export function structuredUpdateBody(data) {
  checkObject(data, {
    highlight: objectOf(Object.fromEntries(['title', 'intro', 'linkText', 'linkUrl', 'image', 'imageAlt', 'imageCaption'].map((key) => [key, string]))),
    committees: objectOf(Object.fromEntries(['technology', 'communityEngagement', 'knowledge', 'coordination'].map((key) => [key, rich]))),
    workgroups: listOf(objectOf({ name: string, updates: rich })),
    geoportal: objectOf({ chartImage: string, chartAlt: string, chartCaption: string, metrics: listOf(objectOf({ label: string, value: string })), topGoogleSearches: listOf(string), topInternalSearches: listOf(string), recordsTotalAsOf: string, recordsTotalValue: string }),
    harvestingActivities: (value, path) => Array.isArray(value) ? listOf(objectOf({ title: string, recordsAdded: string, recordsRetired: string }))(value, path) : string(value, path),
    webDevelopment: objectOf({ updates: rich, moreDetailsUrl: string, moreDetailsLabel: string }),
    priorityProjects: objectOf({ url: string, label: string }),
  }, 'programUpdate');
  const highlight = data.highlight || {};
  let lead = text(highlight.intro);
  if (text(highlight.linkUrl)) lead += `\n\n${link(highlight.linkText, highlight.linkUrl)}`;
  // Preserve orphaned labels/captions too, even if Decap did not render them.
  else if (text(highlight.linkText)) lead += `\n\n${literal(highlight.linkText)}`;
  if (text(highlight.image)) lead += `\n\n${image(highlight.image, highlight.imageAlt, highlight.imageCaption)}`;
  else if (text(highlight.imageCaption)) lead += `\n\n${literal(highlight.imageCaption)}`;
  let body = section(literal(highlight.title || 'Monthly Highlight'), lead) || (text(highlight.title) ? `## ${literal(highlight.title)}\n\n` : '');
  const committees = Object.entries({ technology: 'TECHnology', communityEngagement: 'Community Engagement', knowledge: 'Knowledge', coordination: 'Coordination' })
    .map(([key, name]) => section(name, narrative(data.committees?.[key]), 4)).join('');
  const workgroups = (data.workgroups || []).map((group) => section(literal(group.name || 'Workgroup'), narrative(group.updates), 4) || (text(group.name) ? `#### ${literal(group.name)}\n\n` : '')).join('');
  body += section('Program Activities', section('Committees', committees, 3) + section('Workgroups', workgroups, 3));
  const geo = data.geoportal || {};
  let stats = text(geo.chartImage) ? image(geo.chartImage, geo.chartAlt, geo.chartCaption) : literal(geo.chartCaption || '');
  if (geo.metrics?.length) stats += `\n\n| Metric | Value |\n| --- | --- |\n${geo.metrics.map((metric) => `| ${cell(literal(metric.label))} | ${cell(literal(metric.value))} |`).join('\n')}`;
  let portal = section('This month by the numbers', stats, 3);
  // These links were supplied by the old renderer, not stored in frontmatter.
  portal += `${link('View the analytics dashboard for additional reporting.', 'https://tableau.umn.edu/t/UL/views/BTAAGeoportalusageMatomo/Monthlycharts')}\n\n`;
  portal += section('Top Google searches leading to the Geoportal', (geo.topGoogleSearches || []).map((term) => `- ${literal(term)}`).join('\n'), 3);
  portal += section('Top internal search keywords', (geo.topInternalSearches || []).map((term) => `- ${literal(term)}`).join('\n'), 3);
  body += section('BTAA Geoportal', portal);
  const total = text(geo.recordsTotalAsOf) || text(geo.recordsTotalValue)
    ? `Total records${text(geo.recordsTotalAsOf) ? ` as of ${literal(geo.recordsTotalAsOf)}` : ''}: ${literal(geo.recordsTotalValue)}` : '';
  let harvest = '';
  if (Array.isArray(data.harvestingActivities) && data.harvestingActivities.length) {
    harvest = `| Task | Records added | Records retired |\n| --- | --- | --- |\n${data.harvestingActivities.map((row) => `| ${cell(row.title)} | ${cell(literal(row.recordsAdded))} | ${cell(literal(row.recordsRetired))} |`).join('\n')}`;
  } else harvest = text(data.harvestingActivities);
  harvest += `\n\n${link('View current harvest operations dashboard.', 'https://gin.btaa.org/harvest-operations/')}`;
  body += section('Collections', `${total}\n\n${section('Harvesting Activities', harvest, 3)}`);
  const development = data.webDevelopment || {};
  let updates = narrative(development.updates);
  if (text(development.moreDetailsUrl)) updates += `\n\n${link(development.moreDetailsLabel || 'More development details', development.moreDetailsUrl)}`;
  else if (text(development.moreDetailsLabel)) updates += `\n\n${literal(development.moreDetailsLabel)}`;
  body += section('Web Development', updates);
  if (data.priorityProjects) body += section('Priority Projects Update', text(data.priorityProjects.url) ? link(data.priorityProjects.label || 'Priority Projects board', data.priorityProjects.url) : literal(data.priorityProjects.label || ''));
  return body.trim() + '\n';
}

function dedent(source) {
  const lines = source.split('\n');
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((line) => line.slice(Math.min(indent, line.match(/^ */)[0].length))).join('\n');
}

export function legacyUpdateBody(body) {
  const imports = [];
  const known = new Set();
  for (const segment of splitBody(body, { mergeProtected: false })) {
    const source = segment.content.trim();
    const layout = source.match(/^import (TwoThirdsLayout|CenterLayout|ChipList) from ['"](?:src|@components)\/(?:components\/)?\1\.astro['"];?$/);
    const cards = source.match(/^import \{\s*([A-Za-z]+(?:\s*,\s*[A-Za-z]+)*)\s*\} from ['"]@astrojs\/starlight\/components['"];?$/);
    const names = layout ? [layout[1]] : cards ? cards[1].split(',').map((name) => name.trim()) : null;
    if (names) { names.filter((name) => ['TwoThirdsLayout', 'CenterLayout', 'ChipList', 'Card', 'CardGrid'].includes(name)).forEach((name) => known.add(name)); imports.push({ raw: segment.content, names }); }
  }
  let changes = 0;
  const convert = (source, nested = false) => splitBody(source, { mergeProtected: false }).map((segment) => {
    if (segment.kind === 'markdown') return nested ? dedent(segment.content) : segment.content;
    if (/^\s*(import|export)\s/.test(segment.content)) return segment.content;
    const raw = segment.content;
    const trimmed = raw.trim();
    const wrapper = trimmed.match(/^<(TwoThirdsLayout|CenterLayout|ChipList|CardGrid|Card|div|p|figure|figcaption)([^>]*)>([\s\S]*)<\/\1>$/);
    if (wrapper) {
      const [, tag, attrs, inner] = wrapper;
      const attribute = attrs.trim();
      const simple = (known.has(tag) && (
        (['TwoThirdsLayout', 'CenterLayout', 'CardGrid'].includes(tag) && !attribute) ||
        (tag === 'ChipList' && /^(?:class\s*=\s*["']not-content["'])?$/.test(attribute)) ||
        (tag === 'Card' && /^(?:title\s*=\s*["'][^"'{}<>]*["'])?$/.test(attribute))
      )) || (tag === 'div' && /^(?:class\s*=\s*["'](?:monthly-highlight|compact-list)["']|slot\s*=\s*["'](?:left|right)["'])$/.test(attribute)) ||
        (tag === 'p' && /^class\s*=\s*["']records-total["']$/.test(attribute)) ||
        (tag === 'figure' && /^markdown\s*=\s*["']span["']$/.test(attribute)) || (tag === 'figcaption' && !attribute);
      if (simple) {
        changes += 1;
        const title = tag === 'Card' ? attribute.match(/^title\s*=\s*["']([^"']*)["']$/)?.[1] : null;
        const content = convert(inner, true).trim();
        return `\n\n${title ? `#### ${title}\n\n` : ''}${content}\n\n`;
      }
    }
    const anchor = trimmed.match(/^<a href=["']([^"'{}<>]+)["']>([^<>]+)<\/a>$/);
    if (anchor) { changes += 1; return `\n\n${link(anchor[2], anchor[1])}\n\n`; }
    const aside = trimmed.match(/^:::(?:tip|note|caution|danger)(?:\[([^\]\n]*)\])?\s*\n([\s\S]*?)\n:::\s*$/);
    if (aside) { changes += 1; return `\n\n${aside[1] ? `**${literal(aside[1])}**\n\n` : ''}${convert(aside[2], true).trim()}\n\n`; }
    // Keep unfamiliar components, expressions, and their children verbatim.
    return raw;
  }).join('');
  let converted = convert(body);
  if (!changes) return null;
  for (const entry of imports) {
    const rest = converted.replace(entry.raw, '');
    if (entry.names.every((name) => !new RegExp(`\\b${name}\\b`).test(rest))) converted = rest;
  }
  return converted.trim() + '\n';
}

export function programUpdateConversion(content) {
  const parsed = parsePage(content);
  const data = parseDocument(content.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]).toJS();
  try {
    if (Object.hasOwn(data, 'programUpdate')) {
      const renderer = /^<ProgramUpdateStructured\s+data=\{frontmatter\.programUpdate\}\s*\/>$/;
      const segments = splitBody(parsed.body, { mergeProtected: false });
      const blocks = segments.filter((segment) => segment.kind === 'protected' && renderer.test(segment.content.trim()));
      if (blocks.length !== 1) throw invalid('The structured update has a custom layout that needs manual review before conversion.');
      const generated = structuredUpdateBody(data.programUpdate);
      const body = segments.map((segment) => segment === blocks[0] ? `\n\n${generated}\n\n` : segment.content).join('')
        .replace(/^import ProgramUpdateStructured from ['"]src\/components\/ProgramUpdateStructured\.astro['"];?\r?\n/m, '');
      // Avoid removing frontmatter that another component still references.
      if (/\bprogramUpdate\b|\bProgramUpdateStructured\b/.test(body)) throw invalid('Another part of this update references its structured data and needs manual review.');
      return { body: body.trim() + '\n', kind: 'structured', error: null };
    }
    const body = legacyUpdateBody(parsed.body);
    return body ? { body, kind: 'legacy', error: null } : null;
  } catch (error) {
    return { body: null, kind: 'structured', error: error.message };
  }
}

export function parseProgramUpdate(content) {
  return { ...parsePage(content), conversion: programUpdateConversion(content), convertProgramUpdate: false };
}

export function newProgramUpdate(input) {
  return newBlog({ date: todayCalendar(), draft: true, authors: [{ name: 'BTAA-GIN Staff' }], tags: ['Program Updates'], ...input });
}

export function serializeProgramUpdate(original, input) {
  let base = original;
  if (input.convertProgramUpdate === true) {
    const conversion = programUpdateConversion(original);
    if (!conversion || conversion.error) throw invalid(conversion?.error || 'This update has no supported conversion.');
    if (conversion.kind === 'structured') {
      if (typeof input.body !== 'string' || /\bProgramUpdateStructured\b|frontmatter\.programUpdate\b/.test(input.body)) throw invalid('Apply the editable version before saving this conversion.');
      base = patchFrontmatter(original, { programUpdate: undefined });
    }
  }
  return serializeBlog(base, { ...parsePage(base), ...input });
}

export async function saveProgramUpdate(github, filename, input) {
  let content;
  let saved;
  if (!filename) {
    content = newProgramUpdate(input);
    saved = await github.createBlog({ area: 'updates', title: input.title, suggestedFilename: input.suggestedFilename, content });
  } else {
    if (!input.sha) throw invalid('An existing update SHA is required. Create new updates through the Program Updates collection.');
    const loaded = await github.getContent('updates', filename);
    if (loaded.sha !== input.sha) throw Object.assign(new Error('This page has changed in GitHub since you opened it. Your edits are still here; copy them before reloading.'), { status: 409 });
    content = serializeProgramUpdate(loaded.content, input);
    saved = await github.saveContent({ area: 'updates', filename, content, sha: input.sha });
  }
  return { ...saved, ...(filename ? { filename } : {}), content, ...parseProgramUpdate(content), ...contentVisibility(content) };
}
