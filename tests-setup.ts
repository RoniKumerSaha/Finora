// Vitest setup file. Runs before every spec.
// Wires @testing-library/jest-dom matchers and stubs the localStorage that
// the persistence layer depends on (happy-dom provides one already, but
// this is here in case the env ever flips).

import '@testing-library/jest-dom/vitest';

// happy-dom provides localStorage by default; nothing to do here.
// Reserved for future global mocks (e.g. matchMedia for the theme listener).