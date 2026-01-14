import { Observer, Signal } from "@/shared";
import { signal } from "../signal";

export interface Subscription {
  unsubscribe(): void;
}

export type OperatorFunction<T, R> = (source: Observable<T>) => Observable<R>;

export class Observable<T> {
  __isObservable = true;

  constructor(
    private producer?: (observer: Observer<T>) => void | (() => void)
  ) {}

  public subscribe(
    observerOrNext: Observer<T> | ((value: T) => void),
    error?: (err: any) => void,
    complete?: () => void
  ): Subscription {
    const observer: Observer<T> =
      typeof observerOrNext === "function"
        ? { next: observerOrNext, error, complete }
        : observerOrNext;

    let cleanup: (() => void) | void;
    let isUnsubscribed = false;

    if (this.producer) {
      try {
        cleanup = this.producer(observer);
      } catch (err) {
        if (observer.error) {
          try {
            observer.error(err);
          } catch (e) {
            console.error("Error in error handler during subscription:", e);
          }
        } else {
          throw err;
        }
      }
    }

    return {
      unsubscribe: () => {
        if (isUnsubscribed) return;
        isUnsubscribed = true;
        if (cleanup) {
          try {
            cleanup();
          } catch (err) {
            console.error("Error during cleanup:", err);
          }
        }
      },
    };
  }

  pipe(): Observable<T>;
  pipe<A>(op1: OperatorFunction<T, A>): Observable<A>;
  pipe<A, B>(
    op1: OperatorFunction<T, A>,
    op2: OperatorFunction<A, B>
  ): Observable<B>;
  pipe<A, B, C>(
    op1: OperatorFunction<T, A>,
    op2: OperatorFunction<A, B>,
    op3: OperatorFunction<B, C>
  ): Observable<C>;
  pipe<A, B, C, D>(
    op1: OperatorFunction<T, A>,
    op2: OperatorFunction<A, B>,
    op3: OperatorFunction<B, C>,
    op4: OperatorFunction<C, D>
  ): Observable<D>;
  pipe<A, B, C, D, E>(
    op1: OperatorFunction<T, A>,
    op2: OperatorFunction<A, B>,
    op3: OperatorFunction<B, C>,
    op4: OperatorFunction<C, D>,
    op5: OperatorFunction<D, E>
  ): Observable<E>;
  public pipe(...operations: OperatorFunction<any, any>[]): Observable<any> {
    if (operations.length === 0) {
      return this;
    }
    return operations.reduce((prev, fn) => fn(prev), this as any);
  }
}

export function from<T>(iterable: Iterable<T>): Observable<T> {
  return new Observable((observer) => {
    try {
      for (const value of iterable) {
        observer.next(value);
      }
      observer.complete?.();
    } catch (err) {
      observer.error?.(err);
    }
  });
}

export function interval(ms: number): Observable<number> {
  return new Observable((observer) => {
    let count = 0;
    const id = setInterval(() => {
      observer.next(count++);
    }, ms);
    return () => clearInterval(id);
  });
}

export function of<T>(...values: T[]): Observable<T> {
  return new Observable((observer) => {
    try {
      values.forEach((value) => observer.next(value));
      observer.complete?.();
    } catch (err) {
      observer.error?.(err);
    }
  });
}

export function observable<T>(
  producer?: ((observer: Observer<T>) => void | (() => void)) | undefined
): Observable<T> {
  return new Observable<T>(producer);
}

export function toSignal<T>(
  obs: Observable<T>,
  instance: any
): Signal<T | undefined> {
  const sig = signal<T | undefined>(undefined);

  const subst = obs.subscribe((val) => {
    sig.value = val;
  });

  instance.__cleanup = [
    ...(instance.__cleanup || []),
    () => subst.unsubscribe(),
  ];

  return sig;
}

export function isObservable(value: any): boolean {
  return value && value.__isObservable === true;
}

// Operators
export function map<T, R>(fn: (value: T) => R): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    return new Observable<R>((observer) => {
      const subscription = source.subscribe(
        (value) => {
          try {
            observer.next(fn(value));
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function filter<T>(
  predicate: (value: T) => boolean
): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      const subscription = source.subscribe(
        (value) => {
          try {
            if (predicate(value)) {
              observer.next(value);
            }
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function tap<T>(fn: (value: T) => void): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      const subscription = source.subscribe(
        (value) => {
          try {
            fn(value);
            observer.next(value);
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function take<T>(count: number): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      let taken = 0;
      const subscription = source.subscribe(
        (value) => {
          if (taken < count) {
            observer.next(value);
            taken++;
            if (taken === count) {
              observer.complete?.();
              subscription.unsubscribe();
            }
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function skip<T>(count: number): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      let skipped = 0;
      const subscription = source.subscribe(
        (value) => {
          if (skipped < count) {
            skipped++;
          } else {
            observer.next(value);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function debounceTime<T>(ms: number): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      let timeoutId: any;
      const subscription = source.subscribe(
        (value) => {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            observer.next(value);
          }, ms);
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    });
  };
}

export function throttleTime<T>(ms: number): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      let lastEmit = 0;
      const subscription = source.subscribe(
        (value) => {
          const now = Date.now();
          if (now - lastEmit >= ms) {
            lastEmit = now;
            observer.next(value);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function distinctUntilChanged<T>(
  compare?: (a: T, b: T) => boolean
): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      let hasLast = false;
      let last: T;
      const subscription = source.subscribe(
        (value) => {
          const isDistinct =
            !hasLast || (compare ? !compare(last, value) : last !== value);

          if (isDistinct) {
            hasLast = true;
            last = value;
            observer.next(value);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function switchMap<T, R>(
  fn: (value: T) => Observable<R>
): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    return new Observable<R>((observer) => {
      let innerSubscription: Subscription | null = null;
      const outerSubscription = source.subscribe(
        (value) => {
          if (innerSubscription) {
            innerSubscription.unsubscribe();
          }
          try {
            const innerObservable = fn(value);
            innerSubscription = innerObservable.subscribe(
              (innerValue) => observer.next(innerValue),
              (err) => observer.error?.(err)
            );
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => {
        if (innerSubscription) {
          innerSubscription.unsubscribe();
        }
        outerSubscription.unsubscribe();
      };
    });
  };
}

export function mergeMap<T, R>(
  fn: (value: T) => Observable<R>
): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    return new Observable<R>((observer) => {
      const innerSubscriptions: Subscription[] = [];
      let outerComplete = false;
      let activeCount = 0;

      const checkComplete = () => {
        if (outerComplete && activeCount === 0) {
          observer.complete?.();
        }
      };

      const outerSubscription = source.subscribe(
        (value) => {
          try {
            const innerObservable = fn(value);
            activeCount++;
            const innerSub = innerObservable.subscribe(
              (innerValue) => observer.next(innerValue),
              (err) => observer.error?.(err),
              () => {
                activeCount--;
                checkComplete();
              }
            );
            innerSubscriptions.push(innerSub);
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => {
          outerComplete = true;
          checkComplete();
        }
      );

      return () => {
        innerSubscriptions.forEach((sub) => sub.unsubscribe());
        outerSubscription.unsubscribe();
      };
    });
  };
}

export function concatMap<T, R>(
  fn: (value: T) => Observable<R>
): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    return new Observable<R>((observer) => {
      const queue: T[] = [];
      let innerSubscription: Subscription | null = null;
      let outerComplete = false;
      let isProcessing = false;

      const processNext = () => {
        if (isProcessing || queue.length === 0) {
          if (outerComplete && queue.length === 0) {
            observer.complete?.();
          }
          return;
        }

        isProcessing = true;
        const value = queue.shift()!;

        try {
          const innerObservable = fn(value);
          innerSubscription = innerObservable.subscribe(
            (innerValue) => observer.next(innerValue),
            (err) => observer.error?.(err),
            () => {
              isProcessing = false;
              processNext();
            }
          );
        } catch (err) {
          observer.error?.(err);
        }
      };

      const outerSubscription = source.subscribe(
        (value) => {
          queue.push(value);
          processNext();
        },
        (err) => observer.error?.(err),
        () => {
          outerComplete = true;
          if (queue.length === 0 && !isProcessing) {
            observer.complete?.();
          }
        }
      );

      return () => {
        if (innerSubscription) {
          innerSubscription.unsubscribe();
        }
        outerSubscription.unsubscribe();
      };
    });
  };
}

export function catchError<T>(
  handler: (err: any) => Observable<T>
): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      const subscription = source.subscribe(
        (value) => observer.next(value),
        (err) => {
          try {
            const fallback = handler(err);
            const fallbackSub = fallback.subscribe(
              (value) => observer.next(value),
              (e) => observer.error?.(e),
              () => observer.complete?.()
            );
            (subscription as any).__fallback = fallbackSub;
          } catch (e) {
            observer.error?.(e);
          }
        },
        () => observer.complete?.()
      );
      return () => {
        if ((subscription as any).__fallback) {
          (subscription as any).__fallback.unsubscribe();
        }
        subscription.unsubscribe();
      };
    });
  };
}

export function startWith<T>(...values: T[]): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    return new Observable<T>((observer) => {
      values.forEach((value) => observer.next(value));
      const subscription = source.subscribe(
        (value) => observer.next(value),
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function scan<T, R>(
  accumulator: (acc: R, value: T) => R,
  seed: R
): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    return new Observable<R>((observer) => {
      let acc = seed;
      const subscription = source.subscribe(
        (value) => {
          try {
            acc = accumulator(acc, value);
            observer.next(acc);
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => observer.complete?.()
      );
      return () => subscription.unsubscribe();
    });
  };
}

export function reduce<T, R>(
  accumulator: (acc: R, value: T) => R,
  seed: R
): OperatorFunction<T, R> {
  return (source: Observable<T>) => {
    return new Observable<R>((observer) => {
      let acc = seed;
      const subscription = source.subscribe(
        (value) => {
          try {
            acc = accumulator(acc, value);
          } catch (err) {
            observer.error?.(err);
          }
        },
        (err) => observer.error?.(err),
        () => {
          observer.next(acc);
          observer.complete?.();
        }
      );
      return () => subscription.unsubscribe();
    });
  };
}
