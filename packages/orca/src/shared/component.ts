import { JSX } from "./jsx";
import { Injector } from "./module";

export abstract class OrcaComponent {
  __cleanup: Array<() => void> = [];
  __injector!: Injector;
  props!: any;

  onInit(): void {}

  onDestroy(): void {
    this.__cleanup.forEach((cb) => cb());
  }

  pushDrop(fn: () => void) {
    this.__cleanup.push(fn);
  }

  abstract build(): Node | JSX.Element | Promise<JSX.Element>;
}
