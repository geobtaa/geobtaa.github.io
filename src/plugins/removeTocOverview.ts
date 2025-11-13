import type { StarlightPlugin } from '@astrojs/starlight/types';

export default function removeTocOverview(): StarlightPlugin {
  return {
    name: 'remove-toc-overview',
    hooks: {
      'config:setup': ({ addRouteMiddleware }) => {
        addRouteMiddleware({
          entrypoint: './src/middleware/removeTocOverview.ts',
          order: 'post',
        });
      },
    },
  };
}
