// Vitest setup file. Runs before every spec.
// Wires @testing-library/jest-dom matchers and stubs the persistence
// primitives that the persistence layer depends on. happy-dom provides
// localStorage by default; IndexedDB is polyfilled via fake-indexeddb
// because happy-dom does NOT expose the indexedDB global.

import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// happy-dom provides localStorage by default; nothing to do here.
// Reserved for future global mocks (e.g. matchMedia for the theme listener).