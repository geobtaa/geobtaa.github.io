import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeAttribute, ensureLinkCardImport, parseLinkCardMdx, updateLinkCardMdx } from '../src/components/editor-prototype/linkCardMdx.ts';
import { isSafeComponentHref } from '../src/components/editor-prototype/componentLinkSafety.ts';
import { validateComponentLinks } from './componentLinks.mjs';
import { parseLinkButtonMdx } from '../src/components/editor-prototype/linkButtonMdx.ts';
import { createSimpleComponentMdx, emptySimpleFields, parseSimpleComponentMdx } from '../src/components/editor-prototype/simpleComponents.ts';

test('component URLs accept normal destinations and reject browser scheme obfuscations', () => {
  for (const href of ['', 'https://example.com/?a=1&b=2', 'HTTP://example.com', 'mailto:editor@example.com', 'tel:+15555550123', 'ftp://example.com/maps', '//example.com', '/maps/', '../maps/', '#maps', '?q=maps', 'example.com/maps']) {
    assert.equal(isSafeComponentHref(href), true, href);
    assert.doesNotThrow(() => validateComponentLinks(`<LinkCard title="Maps" href="${href}" />`));
  }
  for (const href of ['javascript:alert(1)', ' JAVASCRIPT:alert(1)', 'java\tscript:alert(1)', '\u0000javascript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,unsafe', 'vbscript:msgbox(1)', 'file:///etc/passwd', 'unknown:foo']) {
    assert.equal(isSafeComponentHref(href), false, href);
  }
  for (const href of ['javascript:alert(1)', 'java&#x73;cript:alert(1)', 'javascript&#58;alert(1)', 'java&Tab;script&colon;alert(1)', 'java&NewLine;script:alert(1)']) {
    for (const body of [`<LinkCard title="Maps" href="${href}" />`, `<LinkButton href="${href}">Maps</LinkButton>`]) assert.throws(() => validateComponentLinks(body), error => error.status === 400);
  }
  assert.doesNotThrow(() => validateComponentLinks('```mdx\n<LinkCard title="Example" href="javascript:example" />\n```'), 'code examples are not executable components');
});

test('attribute entity decoding matches MDX without recursively interpreting literal entity text', () => {
  assert.equal(decodeAttribute('&quot;&apos;&lt;&gt;&amp;&#58;&#x2f;&Tab;&NewLine;&colon;'), '"\'<>&:/\t\n:');
  assert.equal(decodeAttribute('&amp;lt;script&amp;gt; &#38;lt;script&#38;gt; &unknown;'), '&lt;script&gt; &lt;script&gt; &unknown;');
  const button = parseLinkButtonMdx('<LinkButton href="/maps/?q=&#38;lt;">&#38;lt;script&#38;gt;</LinkButton>');
  assert.equal(button.href, '/maps/?q=&lt;');
  assert.equal(button.text, '&lt;script&gt;');
  for (const kind of ['callout', 'card']) {
    const fields = { ...emptySimpleFields(), title: 'Literal &#60;title&#62;', text: 'Literal &#60;script&#62; and &colon;' };
    assert.deepEqual(parseSimpleComponentMdx(createSimpleComponentMdx(kind, fields)).fields, fields);
  }
});

test('Link Card attributes survive empty values, name-like values, and repeated clear/reopen/refill edits', () => {
  for (const quote of ['"', "'"]) {
    for (const value of ['', 'title', 'href', 'description']) {
      let source = `<LinkCard title=${quote}${value}${quote} href=${quote}${value}${quote} description=${quote}${value}${quote} />`;
      for (const fields of [
        { title: 'New title', href: '/maps/', description: 'A description' },
        { title: '', href: '', description: '' },
        { title: 'Maps & "more"', href: '/maps/?a=1&b=2', description: "An editor's description" },
      ]) {
        source = updateLinkCardMdx(source, fields);
        const parsed = parseLinkCardMdx(source);
        assert.ok(parsed, source);
        assert.deepEqual({ title: parsed.title, href: parsed.href, description: parsed.description }, fields);
        assert.equal(updateLinkCardMdx(source, fields), source, 'reopening must not keep changing the source');
      }
    }
  }
  assert.equal(updateLinkCardMdx('<LinkCard title="Maps" href="/maps/"/>', { title: 'Maps', href: '/maps/', description: 'More maps' }), '<LinkCard title="Maps" href="/maps/" description="More maps" />');
});

test('Link Card import handling preserves multiline imports and ignores fenced examples', () => {
  for (const newline of ['\n', '\r\n']) {
    const existing = ["import {", '  Card,', '  LinkCard as LinkCard,', "} from '@astrojs/starlight/components';", '', 'Body'].join(newline);
    assert.deepEqual(ensureLinkCardImport(existing), { content: existing, added: false });
    const other = ["import {", '  Card,', "} from '@astrojs/starlight/components';", '', 'Body'].join(newline);
    const added = ensureLinkCardImport(other);
    assert.ok(added.content.startsWith(other.slice(0, other.indexOf(`${newline}${newline}`))), 'leave the complete import intact');
    assert.equal(ensureLinkCardImport(added.content).content, added.content);
    for (const fence of ['```js', '~~~~js']) {
      const example = [fence, "import { LinkCard } from '@astrojs/starlight/components';", fence.replace('js', ''), '', 'Body'].join(newline);
      const result = ensureLinkCardImport(example);
      assert.equal(result.added, true, 'a code sample does not supply an actual import');
      assert.ok(result.content.endsWith(example), 'do not edit the fenced source');
    }
  }
});

test('Link Card import handling rejects existing bindings without changing source', () => {
  for (const source of [
    "import LinkCard from './Other.astro';\n\nBody",
    "import { Card as LinkCard } from '@astrojs/starlight/components';\n\nBody",
    "import * as LinkCard from './other';\n\nBody",
    'export const LinkCard = () => null;\n\nBody',
  ]) {
    const result = ensureLinkCardImport(source);
    assert.ok(result.error, source);
    assert.equal(result.content, source);
    assert.equal(result.added, false);
  }
});
