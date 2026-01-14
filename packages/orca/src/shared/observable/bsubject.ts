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

  public setValue(value: T) {
    this._value = value;
  }

  public next(value: T): void {
    this._value = value;
    super.next(value);
  }

  public subscribe(
    observerOrNext: Observer<T> | ((value: T) => void),
    error?: (err: any) => void,
    complete?: () => void
  ): Subscription {
    const observer: Observer<T> =
      typeof observerOrNext === "function"
        ? { next: observerOrNext, error, complete }
        : observerOrNext;

    try {
      observer.next(this._value);
    } catch (err) {
      if (observer.error) {
        observer.error(err);
      }
    }

    return super.subscribe(observer);
  }
}
