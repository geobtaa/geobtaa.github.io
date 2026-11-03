import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLinkAddress } from '../src/components/editor-prototype/linkAddress.ts';

test('website addresses can omit https without changing their path, query, or fragment', () => {
  for (const address of ['example.com', 'www.example.org/maps', 'geo.btaa.org/search?q=maps#results', 'maps.example.museum:8080/view']) {
    assert.equal(normalizeLinkAddress(` ${address} `), `https://${address}`);
  }
});

test('existing schemes, internal references, and local files retain their meaning', () => {
  for (const address of ['', '/guides/help/', '//example.com/maps', './help/', '../help/', 'guides/help/', '#details', '?q=maps', 'document.pdf', 'map.geojson', 'data.gpkg', 'archive.tar.gz', 'guide.mdx', 'index.html', 'http://example.com', 'https://example.com', 'mailto:editor@example.com', 'tel:+15555550123', 'ftp://example.com/maps', 'editor@example.com', 'A path with spaces']) {
    assert.equal(normalizeLinkAddress(address), address);
  }
});
