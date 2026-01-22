import { Observer } from "../types";
import { Subscription } from "./observable";
import { Subject } from "./subject";

export class BehaviorSubject<T> extends Subject<T> {
  private _value: T;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  public get $value(): T {
    return this._value;
  }

  public next(value: T): void {
    this._value = value;
    super.next(value);
  }

  public subscribe(
    observerOrNext: Observer<T> | ((value: T) => void),
    error?: (err: any) => void,
    complete?: () => void,
  ): Subscription {
    const observer: Observer<T> =
      typeof observerOrNext === "function"
        ? { next: observerOrNext, error, complete }
        : observerOrNext;

    if (this._hasError) {
      observer.error?.(this._thrownError);
      return { unsubscribe: () => {} };
    }

    if (this._isCompleted) {
      observer.complete?.();
      return { unsubscribe: () => {} };
    }

    observer.next(this._value);
    return super.subscribe(observer);
  }
}
