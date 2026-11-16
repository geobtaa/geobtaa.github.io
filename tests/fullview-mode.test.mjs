import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

test('fullview plugin applies defaults with Zod 4 and preserves explicit site options', async () => {
  // Load the real package and its TypeScript imports using the site's loader.
  const server = await createServer({
    configFile: false, logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    ssr: { noExternal: ['starlight-fullview-mode'] },
  });
  try {
    const { default: fullview } = await server.ssrLoadModule('starlight-fullview-mode');
    const defaults = {
      leftSidebarEnabled: true, rightSidebarEnabled: true,
      leftSidebarExpandedWidth: null, rightSidebarExpandedWidth: null,
      leftSidebarCollapsedWidth: '50px', rightSidebarCollapsedWidth: '50px',
      rotateSidebarToggleWhenClosed: true, overrideWarnEnabled: false,
    };
    for (const options of [undefined, {}, { leftSidebarEnabled: false }, {
      rightSidebarEnabled: false, rightSidebarExpandedWidth: '20rem',
      leftSidebarCollapsedWidth: '64px', rotateSidebarToggleWhenClosed: false,
    }]) {
      let integration, updated;
      await fullview(options).hooks['config:setup']({
        config: { components: {} }, logger: { warn: assert.fail },
        addIntegration(value) { integration = value; },
        updateConfig(value) { updated = value; },
      });
      let vite;
      integration.hooks['astro:config:setup']({ updateConfig(value) { vite = value.vite; } });
      const virtual = vite.plugins[0];
      const rendered = virtual.load(virtual.resolveId('virtual:starlight-fullview-mode-config'));
      assert.deepEqual(JSON.parse(rendered.replace(/^export default /, '')), { ...defaults, ...options });
      assert.equal(!!updated.components.Sidebar, options?.leftSidebarEnabled !== false);
      assert.equal(!!updated.components.TableOfContents, options?.rightSidebarEnabled !== false);
    }
    assert.throws(() => fullview({ leftSidebarEnabled: 'invalid' }), /plugin configuration is invalid/);
  } finally { await server.close(); }
});
