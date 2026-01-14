import { Observer } from "../types";
import { Observable, Subscription } from "./observable";

export class Subject<T> extends Observable<T> {
  private subscribers: Set<Observer<T>> = new Set();
  private _isCompleted = false;
  private _hasError = false;

  constructor() {
    super();
  }

  public subscribe(
    observerOrNext: Observer<T> | ((value: T) => void),
    error?: (err: any) => void,
    complete?: () => void
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
    const currentSubscribers = Array.from(this.subscribers);

    currentSubscribers.forEach((observer) => {
      if (observer.error) {
        try {
          observer.error(err);
        } catch (e) {
          console.error("Error in error handler:", e);
        }
      }
    });

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
