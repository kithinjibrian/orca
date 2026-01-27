import { Observable } from "rxjs";
import { Signal } from "../types";
import { signal } from "./signal";

export function toSignal<T>(
  obs: Observable<T>,
  instance: any,
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
