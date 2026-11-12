import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia = vi.fn().mockImplementation(() => ({
  matches: false,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
}));

// jsdom has no Web Locks; model the browser's queue for repository integration tests.
const lockQueues = new Map();
const heldLocks = new Set();
Object.defineProperty(navigator, 'locks', {
  configurable: true,
  value: {
    request(name, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = {};
      }
      if (options.ifAvailable && heldLocks.has(name)) return Promise.resolve(callback(null));
      const previous = lockQueues.get(name) ?? Promise.resolve();
      const operation = previous
        .then(() => {
          heldLocks.add(name);
          return callback({ name, mode: 'exclusive' });
        })
        .finally(() => heldLocks.delete(name));
      lockQueues.set(
        name,
        operation.catch(() => undefined),
      );
      return operation;
    },
  },
});
