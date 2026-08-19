// Module-scope fan-out: a settings save pushes every mounted surface to reload.

export const refreshSignal = {
  listeners: new Set<() => void>(),
  subscribe(fn: () => void) {
    refreshSignal.listeners.add(fn);
    return () => {
      refreshSignal.listeners.delete(fn);
    };
  },
  notify() {
    for (const fn of [...refreshSignal.listeners]) {
      try {
        fn();
      } catch {
        /* keep other listeners alive */
      }
    }
  },
};
