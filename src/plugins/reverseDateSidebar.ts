import type { StarlightPlugin } from '@astrojs/starlight/types';

export default function reverseDateSidebar(): StarlightPlugin {
  return {
    name: 'reverse-date-sidebar',
    hooks: {
      'config:setup': ({ addRouteMiddleware }) => {
        addRouteMiddleware({ entrypoint: './src/middleware/reverseDateSidebar.ts', order: 'post' });
      },
    },
  };
}
