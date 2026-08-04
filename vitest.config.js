import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // The suite spawns CLI subprocesses and evaluates a ~300-item corpus;
    // under full parallel load those can exceed the 5s default. 15s is a
    // stability margin, not a mask for slow logic (evalCorpus keeps its own
    // explicit 20s timeout).
    testTimeout: 15_000,
  },
});
