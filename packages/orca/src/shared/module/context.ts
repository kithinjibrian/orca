import { Injector } from "./injector";

let currentInjector: Injector | null = null;

export function setCurrentInjector(injector: Injector) {
  currentInjector = injector;
}

export function getCurrentInjector(): Injector | null {
  return currentInjector;
}
