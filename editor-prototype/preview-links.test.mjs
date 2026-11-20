import assert from 'node:assert/strict';
import test from 'node:test';
import { previewHref, previewComponentLink } from '../src/components/editor-prototype/previewLinks.ts';

test('CMS public links resolve on the public website without changing stored hrefs or other destinations', () => {
  const site = 'https://gin.btaa.org';
  const href = '/library/example/?view=full#details';
  assert.equal(previewHref(href, site), site + href);
  assert.equal(previewHref(href), href, 'ordinary public/staging builds retain their current behavior');
  for (const destination of ['https://example.com/', '//example.com/', '../help/', '#details', '?preview=1', 'mailto:editor@example.com', '/\\outside.example/', '/\n/outside.example/']) {
    assert.equal(previewHref(destination, site), destination);
  }
  for (const unsafe of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,unsafe']) {
    assert.equal(previewComponentLink(unsafe).href, undefined);
  }
});
