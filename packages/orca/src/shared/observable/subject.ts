import { Observer } from "../types";
import { Observable, Subscription } from "./observable";

export class Subject<T> extends Observable<T> {
  protected subscribers: Set<Observer<T>> = new Set();
  protected _isCompleted = false;
  protected _hasError = false;
  protected _thrownError: any = null;

  constructor() {
    super();
  }

  public asObservable(): Observable<T> {
    return new Observable<T>((observer) => {
      const subscription = this.subscribe(observer);
      return () => subscription.unsubscribe();
    });
  }

  public subscribe(
    observerOrNext: Observer<T> | ((value: T) => void),
    error?: (err: any) => void,
    complete?: () => void,
  ): Subscription {
    if (this._isCompleted) {
      const obs =
        typeof observerOrNext === "function" ? { complete } : observerOrNext;
      obs.complete?.();
      return { unsubscribe: () => {} };
    }

    if (this._hasError) {
      return { unsubscribe: () => {} };
    }

    const observer: Observer<T> =
      typeof observerOrNext === "function"
        ? { next: observerOrNext, error, complete }
        : observerOrNext;

    this.subscribers.add(observer);

    return {
      unsubscribe: () => {
        this.subscribers.delete(observer);
      },
    };
  }

  public next(value: T): void {
    if (this._isCompleted || this._hasError) return;

    const currentSubscribers = Array.from(this.subscribers);
    currentSubscribers.forEach((observer) => {
      if (this.subscribers.has(observer)) {
        try {
          observer.next(value);
        } catch (err) {
          console.error("Error in observer:", err);
        }
      }
    });
  }

  public error(err: any): void {
    if (this._isCompleted || this._hasError) return;

    this._hasError = true;
    this._thrownError = err;

    for (const observer of this.subscribers) {
      observer.error?.(err);
    }

    this.subscribers.clear();
  }

  public complete(): void {
    if (this._isCompleted || this._hasError) return;

    this._isCompleted = true;
    const currentSubscribers = Array.from(this.subscribers);

    currentSubscribers.forEach((observer) => {
      if (observer.complete) {
        try {
          observer.complete();
        } catch (err) {
          console.error("Error in complete handler:", err);
        }
      }
    });

    this.subscribers.clear();
  }
}
