// Vitest setup file. Runs before every spec.
// Wires @testing-library/jest-dom matchers and stubs the persistence
// primitives that the persistence layer depends on. happy-dom provides
// localStorage by default; IndexedDB is polyfilled via fake-indexeddb
// because happy-dom does NOT expose the indexedDB global.

import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Cloud sync (V1.x): install a fake Supabase client so SyncEngine
// never tries to hit the network. The fake is reset between tests via
// the afterEach hook below.
import { installFakeSupabase, resetSyncBetweenTests } from './src/test/sync-helpers';
import { resetIDB } from './src/test/idb-helpers';

beforeEach(() => {
  installFakeSupabase();
});

// Wipe IndexedDB + sync state between tests so they don't leak. This
// mirrors the pattern of running each spec against a fresh app boot.
afterEach(async () => {
  resetSyncBetweenTests();
  await resetIDB();
});

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
