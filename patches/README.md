# Dependency patches

`npm install` and `npm ci` apply these patches through `patch-package`.

`starlight-fullview-mode+0.2.6.patch` replaces the configuration schema's
`.default({})` with `.prefault({})` for compatibility with Astro's Zod 4.
The empty object must pass through the schema so each option receives its
default value. Zod 4's `.default()` returns the object without parsing it,
which also causes a TypeScript error because required output fields are absent.

Remove the patch when an upstream release includes this fix. Run
`npm run test:config` and `npx tsc --noEmit` after updating the dependency.
