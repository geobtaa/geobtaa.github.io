import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import { copyFile } from 'node:fs/promises';

// Selected explicitly by gin-editor. The public site's config and build stay separate.
export default defineConfig({
  site: 'https://gin-editor.pages.dev',
  output: 'static',
  // No public pages or content collections are discovered from this source root.
  srcDir: './src/pages/editor',
  publicDir: './editor-prototype/cloudflare-public',
  outDir: './dist-editor',
  cacheDir: './node_modules/.astro-editor',
  compressHTML: true,
  vite: {
    define: {
      'import.meta.env.PUBLIC_PROJECT_EDITOR_API_URL': JSON.stringify(''),
      'import.meta.env.PUBLIC_PROJECT_EDITOR_SITE_URL': JSON.stringify('https://gin.btaa.org'),
    },
  },
  integrations: [
    react(),
    {
      name: 'gin-editor-only',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          injectRoute({
            pattern: '/',
            entrypoint: new URL('./src/pages/editor/index.astro', import.meta.url),
          });
        },
        'astro:build:done': async ({ dir }) => {
          // Keep every generated dependency. Only add shared Pages support files.
          await copyFile(new URL('./public/_routes.json', import.meta.url), new URL('_routes.json', dir));
          try {
            await copyFile(new URL('./public/_headers', import.meta.url), new URL('_headers', dir));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        },
      },
    },
  ],
});
