const sessions = new WeakMap();

// A reader never reserves editing. A writer starts before its first storage read,
// in a fresh document, because separate tabs can cache localStorage snapshots.
export function getEditingSession(key, lockManager = globalThis.navigator?.locks) {
  let modes = lockManager && sessions.get(lockManager);
  if (modes?.has(key)) return modes.get(key);
  let access = {
    canWrite: false,
    supported: Boolean(lockManager?.request),
    reason: lockManager?.request ? 'view' : 'unsupported',
  };
  let readStarted = false;
  let retired = false;
  let ready;
  let holding;
  let release;
  const listeners = new Set();
  const update = (reason) => {
    access = { ...access, canWrite: reason === 'editing', reason };
    for (const listener of listeners) listener({ ...access });
  };
  const stop = () => {
    retired = true;
    update('reload');
    release?.();
    return holding ?? Promise.resolve();
  };
  globalThis.addEventListener?.('pagehide', stop, { once: true });

  const session = {
    getAccess: () => ({ ...access }),
    noteRead: () => (readStarted = true),
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...access });
      return () => listeners.delete(listener);
    },
    async start() {
      if (access.canWrite) return true;
      if (!access.supported) return false;
      if (retired || readStarted) {
        update('reload');
        return false;
      }
      if (ready) return ready;
      let resolveReady;
      ready = new Promise((resolve) => (resolveReady = resolve));
      holding = Promise.resolve()
        .then(() =>
          lockManager.request(`${key}:editor`, { ifAvailable: true }, (lock) => {
            if (retired || readStarted || !lock) {
              update(retired || readStarted ? 'reload' : 'other-tab');
              resolveReady(false);
              return;
            }
            update('editing');
            resolveReady(true);
            return new Promise((resolve) => (release = resolve));
          }),
        )
        .catch(() => {
          update('blocked');
          resolveReady(false);
        });
      return ready;
    },
    stop,
  };
  if (lockManager) {
    if (!modes) {
      modes = new Map();
      sessions.set(lockManager, modes);
    }
    modes.set(key, session);
  }
  return session;
}
