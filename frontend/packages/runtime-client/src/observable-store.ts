/**
 * Minimal observable store with the svelte store contract — synchronous
 * current-value emission on subscribe, set/update/subscribe — and zero
 * framework imports, so the workspace data layer stays portable while the
 * React migration consumes the same stores.
 */

export type ObservableStore<T> = {
  get: () => T;
  set: (value: T) => void;
  update: (fn: (current: T) => T) => void;
  subscribe: (run: (value: T) => void) => () => void;
};

type ReadableStore<T> = Pick<ObservableStore<T>, 'get' | 'subscribe'>;
type StoreValues<Sources extends readonly ReadableStore<unknown>[]> = {
  [Index in keyof Sources]: Sources[Index] extends ReadableStore<infer Value> ? Value : never;
};

export const createObservableStore = <T>(initial: T): ObservableStore<T> => {
  const listeners = new Set<(value: T) => void>();
  let current = initial;
  return {
    get: () => current,
    set: value => {
      current = value;
      for (const listener of listeners) listener(value);
    },
    update: fn => {
      current = fn(current);
      for (const listener of listeners) listener(current);
    },
    subscribe: run => {
      listeners.add(run);
      run(current);
      return () => listeners.delete(run);
    },
  };
};

export const createReadableStore = <T>(
  initial: T,
  start: (set: (value: T) => void) => void | (() => void),
): Pick<ObservableStore<T>, 'get' | 'subscribe'> => {
  const listeners = new Set<(value: T) => void>();
  let current = initial;
  let stop: void | (() => void);
  const set = (value: T): void => {
    current = value;
    for (const listener of listeners) listener(value);
  };
  return {
    get: () => current,
    subscribe: run => {
      listeners.add(run);
      if (listeners.size === 1) stop = start(set);
      run(current);
      return () => {
        listeners.delete(run);
        if (listeners.size === 0) {
          stop?.();
          stop = undefined;
        }
      };
    },
  };
};

/**
 * One-shot read of any store-contract object (svelte writable or
 * ObservableStore): subscribe, capture, unsubscribe. This is exactly how
 * svelte's get() behaves, without importing the framework.
 */
export const readStoreValue = <T>(store: {
  subscribe: (run: (value: T) => void) => () => void;
}): T => {
  let value!: T;
  const unsubscribe = store.subscribe(next => { value = next; });
  unsubscribe();
  return value;
};

export function createDerivedStore<Source, Value>(
  source: ReadableStore<Source>,
  project: (value: Source) => Value,
): ObservableStore<Value>;
export function createDerivedStore<Sources extends readonly ReadableStore<unknown>[], Value>(
  sources: readonly [...Sources],
  project: (values: StoreValues<Sources>) => Value,
): ObservableStore<Value>;
export function createDerivedStore<Value>(
  sourceOrSources: ReadableStore<unknown> | readonly ReadableStore<unknown>[],
  project: (value: never) => Value,
): ObservableStore<Value> {
  const sources = Array.isArray(sourceOrSources) ? sourceOrSources : [sourceOrSources];
  const read = (): never => (Array.isArray(sourceOrSources)
    ? sources.map(source => source.get())
    : sources[0]!.get()) as never;
  const derived = createObservableStore(project(read()));
  for (const source of sources) source.subscribe(() => derived.set(project(read())));
  return derived;
}
