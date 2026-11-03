import assert from 'node:assert/strict';
import test from 'node:test';
import remarkFormattedImages from '../src/plugins/remarkFormattedImages.ts';
import remarkCenterLayoutImages from '../src/plugins/remarkCenterLayoutImages.ts';

function figure(align, width, title = 'A caption & <literal text>') {
  return {
    type: 'mdxJsxFlowElement', name: 'figure',
    attributes: Object.entries({ 'data-cms-image': 'true', 'data-align': align, ...(width ? { 'data-width': width } : {}) }).map(([name, value]) => ({ type: 'mdxJsxAttribute', name, value })),
    children: [{ type: 'paragraph', children: [{ type: 'image', url: '@images/map.png', alt: 'A map', title }] }],
  };
}

test('Astro formats owned figures across content areas and adds captions without double-centering blog images', () => {
  for (const area of ['posts', 'guides']) {
    for (const align of ['left', 'center', 'right']) {
      const node = figure(align, '320');
      const tree = { type: 'root', children: [node] };
      remarkFormattedImages()(tree);
      remarkCenterLayoutImages()(tree, { path: `/src/content/docs/${area}/example.mdx` });
      assert.equal(tree.children.length, 1, 'no component imports or extra wrappers');
      assert.equal(tree.children[0].name, 'figure');
      assert.equal(node.children[0].children[0].url, '@images/map.png');
      assert.equal(node.children[0].children[0].alt, 'A map');
      assert.equal(node.children[1].name, 'figcaption');
      assert.equal(node.children[1].children[0].children[0].children[0].value, 'A caption & <literal text>');
      const style = node.attributes.find(a => a.name === 'style').value;
      assert.match(style, /width:320px;max-width:100%/);
      assert.ok(style.endsWith(`margin:1rem ${align === 'right' ? '0' : 'auto'} 1rem ${align === 'left' ? '0' : 'auto'};`));
    }
  }
  const node = figure('center', null, null);
  remarkFormattedImages()({ type: 'root', children: [node] });
  assert.equal(node.children.length, 1, 'captionless images have no empty figcaption');
});

test('Astro leaves unfamiliar figures untouched', () => {
  for (const modify of [
    n => n.attributes.push({ type: 'mdxJsxAttribute', name: 'class', value: 'legacy' }),
    n => n.attributes.push({ type: 'mdxJsxAttribute', name: 'data-width', value: '320' }),
    n => n.attributes.find(a => a.name === 'data-width').value = '0',
    n => n.attributes.find(a => a.name === 'data-align').value = 'float',
    n => n.children.push({ type: 'paragraph', children: [{ type: 'text', value: 'Other content' }] }),
    n => n.attributes.find(a => a.name === 'data-cms-image').value = 'false',
  ]) {
    const node = figure('left', '320'); modify(node);
    const before = structuredClone(node);
    remarkFormattedImages()({ type: 'root', children: [node] });
    assert.deepEqual(node, before);
  }
});

test('plain Markdown figures get the same layout and escaped caption without changing their asset path', () => {
  const image = { type: 'image', url: '@images/map.png', alt: 'A map', title: 'A & <literal> caption' };
  const tree = { type: 'root', children: [
    { type: 'html', value: '<figure data-cms-image="true" data-align="left" data-width="320">\n' },
    { type: 'paragraph', children: [image] },
    { type: 'html', value: '</figure>\n' },
  ] };
  remarkFormattedImages()(tree);
  remarkCenterLayoutImages()(tree, { path: '/src/content/docs/posts/example.md' });
  assert.equal(tree.children.length, 3);
  assert.match(tree.children[0].value, /width:320px;max-width:100%;margin:1rem auto 1rem 0/);
  assert.equal(image.url, '@images/map.png');
  assert.equal(tree.children[2].value, '<figcaption><p><em>A &amp; &lt;literal&gt; caption</em></p></figcaption>\n</figure>\n');
});
