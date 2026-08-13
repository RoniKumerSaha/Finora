/**
 * vite-env.d.ts — TypeScript declarations for Vite-specific imports.
 *
 * Without this, `import logo from './logo.svg?url'` or the bare
 * `import logo from './logo.svg'` (which Vite resolves as a URL) fails
 * typecheck. Reference Vite's bundled client types too.
 */
/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}
