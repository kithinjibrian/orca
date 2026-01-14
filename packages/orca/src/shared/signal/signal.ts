import { Signal } from "@/shared";

let currentEffect: EffectRunner | null = null;
let batchDepth = 0;
let pendingEffects = new Set<EffectRunner>();

interface InternalSignal<T> extends Signal<T> {
  _isSignal: true;
  _subscribers: Set<EffectRunner>;
}

interface EffectRunner {
  (): void;
  execute(): void;
  cleanup(): void;
  deps: Set<Set<EffectRunner>>;
  cleanupFn?: () => void;
}

export function signal<T>(initialValue: T): Signal<T> {
  let value = initialValue;
  const subscribers = new Set<EffectRunner>();

  const notify = () => {
    subscribers.forEach((sub) => pendingEffects.add(sub));
    if (batchDepth === 0) {
      const effects = Array.from(pendingEffects);
      pendingEffects.clear();
      effects.forEach((effect) => effect.execute());
    }
  };

  return {
    _isSignal: true as const,
    _subscribers: subscribers,
    get value(): T {
      if (currentEffect) {
        subscribers.add(currentEffect);
        currentEffect.deps.add(subscribers);
      }
      return value;
    },
    set value(newValue: T) {
      if (value !== newValue) {
        value = newValue;
        notify();
      }
    },
  } as InternalSignal<T>;
}

export function effect(fn: () => void | (() => void)): () => void {
  const deps = new Set<Set<EffectRunner>>();
  let cleanupFn: (() => void) | undefined;

  const runner: EffectRunner = (() => {
    runner.execute();
  }) as EffectRunner;

  runner.deps = deps;

  runner.execute = () => {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = undefined;
    }

    deps.forEach((subs) => subs.delete(runner));
    deps.clear();

    const prevEffect = currentEffect;
    currentEffect = runner;

    try {
      const result = fn();
      if (typeof result === "function") {
        cleanupFn = result;
      }
    } finally {
      currentEffect = prevEffect;
    }
  };

  runner.cleanup = () => {
    if (cleanupFn) {
      cleanupFn();
      cleanupFn = undefined;
    }
    deps.forEach((subs) => subs.delete(runner));
    deps.clear();
  };

  runner.cleanupFn = cleanupFn;

  runner.execute();

  return () => runner.cleanup();
}

export function computed<T>(fn: () => T): Signal<T> {
  const sig = signal(fn());
  let cleanup: (() => void) | undefined;

  cleanup = effect(() => {
    sig.value = fn();
  });

  const originalSignal = sig as InternalSignal<T>;
  const dispose = cleanup;

  (originalSignal as any).dispose = dispose;

  return sig;
}

export function batch(fn: () => void): void {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const effects = Array.from(pendingEffects);
      pendingEffects.clear();
      effects.forEach((effect) => effect.execute());
    }
  }
}

export function isSignal(value: any): boolean {
  return value && value._isSignal === true;
}

export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const cleanups: Array<() => void> = [];
  const dispose = () => {
    cleanups.forEach((cleanup) => cleanup());
    cleanups.length = 0;
  };

  const prevEffect = currentEffect;

  const originalEffect = effect;
  (globalThis as any).effect = (fn: () => void | (() => void)) => {
    const cleanup = originalEffect(fn);
    cleanups.push(cleanup);
    return cleanup;
  };

  try {
    return fn(dispose);
  } finally {
    (globalThis as any).effect = originalEffect;
    currentEffect = prevEffect;
  }
}

export function untracked<T>(fn: () => T): T {
  const prevEffect = currentEffect;
  currentEffect = null;
  try {
    return fn();
  } finally {
    currentEffect = prevEffect;
  }
}
