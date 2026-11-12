import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  window.dispatchEvent(new Event('pagehide'));
  window.localStorage.clear();
  window.sessionStorage.clear();
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
beforeEach(() => {
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
        if (options.ifAvailable) {
          return Promise.resolve().then(() => {
            if (heldLocks.has(name)) return callback(null);
            heldLocks.add(name);
            return Promise.resolve(callback({ name, mode: 'exclusive' })).finally(() =>
              heldLocks.delete(name),
            );
          });
        }
        const previous = lockQueues.get(name) ?? Promise.resolve();
        const operation = previous.then(() => callback({ name, mode: 'exclusive' }));
        lockQueues.set(
          name,
          operation.catch(() => undefined),
        );
        return operation;
      },
      query: async () => ({ held: [...heldLocks].map((name) => ({ name })), pending: [] }),
    },
  });
});
