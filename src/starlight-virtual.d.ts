// Starlight provides these runtime modules through Vite. Declare only the
// modules used by our overrides, using public package types and exports.
declare module 'virtual:starlight/user-config' {
  const config: import('@astrojs/starlight/types').StarlightConfig;
  export default config;
}

declare module 'virtual:starlight/user-images' {
  export const logos: {
    dark?: import('astro').ImageMetadata;
    light?: import('astro').ImageMetadata;
  };
}

declare module 'virtual:starlight/components/LanguageSelect' {
  export { default } from '@astrojs/starlight/components/LanguageSelect.astro';
}

declare module 'virtual:starlight/components/Search' {
  export { default } from '@astrojs/starlight/components/Search.astro';
}

declare module 'virtual:starlight/components/SocialIcons' {
  export { default } from '@astrojs/starlight/components/SocialIcons.astro';
}
