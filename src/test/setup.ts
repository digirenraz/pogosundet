// jest-dom v7 split its type augmentation per test runner: the root entry
// only declares Jest's globals, so importing it under Vitest registers the
// matchers at runtime but leaves `expect(...).toHaveAttribute()` untyped.
// The /vitest entry augments Vitest's own `Assertion` interface, which is
// what keeps `npm run typecheck` green. See @testing-library/jest-dom
// types/vitest.d.ts.
import '@testing-library/jest-dom/vitest';
