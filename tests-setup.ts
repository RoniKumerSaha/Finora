// Vitest setup file. Runs before every spec.
// Wires @testing-library/jest-dom matchers and stubs the persistence
// primitives that the persistence layer depends on. happy-dom provides
// localStorage by default; IndexedDB is polyfilled via fake-indexeddb
// because happy-dom does NOT expose the indexedDB global.

import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// happy-dom does NOT provide crypto.subtle either. Web Crypto is
// required by the PIN lock feature (src/security/pin.ts). Polyfill
// from Node's webcrypto so SHA-256 hashing + secure random salts work
// in unit tests without per-test mocks. node:webcrypto ships in
// Node 19+; @types/node is not installed (intentional — keeps the
// prod bundle clean).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto?.subtle) {
  // Happy-dom defines a getter-only `crypto` that throws on access.
  // Use defineProperty to override it.
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}
