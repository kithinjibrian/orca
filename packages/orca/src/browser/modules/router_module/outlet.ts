import {
  Component,
  JSX,
  OrcaComponent,
  OSC,
  Observable,
  Subscription,
} from "@/shared";
import { Navigate } from "./navigate";

@Component()
export class RouterOutlet extends OrcaComponent {
  private activeStreamSubscription: Subscription | null = null;

  constructor(public navigate: Navigate) {
    super();
  }

  build() {
    const anchor = document.createElement("div");

    const subscription = this.navigate.pages.subscribe((pages) => {
      this.renderCurrentPage(anchor, pages);
    });

    this.pushDrop(() => subscription.unsubscribe());
    this.pushDrop(() => {
      if (this.activeStreamSubscription) {
        this.activeStreamSubscription.unsubscribe();
      }
    });

    return anchor;
  }

  private renderCurrentPage(
    anchor: HTMLElement,
    pages: (Node | JSX.Element | Observable<any>)[]
  ) {
    const currentItem = pages[this.navigate.cursor];

    if (!currentItem) {
      anchor.replaceChildren();
      return;
    }

    if (this.activeStreamSubscription) {
      this.activeStreamSubscription.unsubscribe();
      this.activeStreamSubscription = null;
    }

    if (this.isObservable(currentItem)) {
      this.renderStream(anchor, currentItem as Observable<JSX.Element>);
    } else {
      anchor.replaceChildren(currentItem as any);
    }
  }

  private renderStream(anchor: HTMLElement, stream: Observable<JSX.Element>) {
    const root = document.createElement("div");
    anchor.replaceChildren(root);
    const osc = new OSC(root);

    this.activeStreamSubscription = stream.subscribe(
      (jsx: JSX.Element) => {
        const action = jsx.action || "insert";
        if (action === "insert") {
          osc.handleInsert(jsx);
        } else if (action === "update") {
          osc.handleUpdate(jsx);
        } else {
          console.warn(`Unknown action: ${action}`);
        }
      },
      (error) => {
        console.error("Stream error:", error);
      },
      () => {
        const resolvedElement = osc.tree.dom;
        this.navigate.resolveStream(this.navigate.cursor, resolvedElement);
        this.activeStreamSubscription = null;
      }
    );
  }

  private isObservable(obj: any): obj is Observable<any> {
    return obj && typeof obj.subscribe === "function";
  }
}
