import { Component, JSX, OrcaComponent, OSC } from "@/shared";
import { Navigate } from "./navigate";
import { Observable, Subscription } from "rxjs";

interface StreamSubscriptionInfo {
  subscription: Subscription;
  index: number;
}

@Component()
export class RouterOutlet extends OrcaComponent {
  private activeStreamSubscriptions: Map<number, StreamSubscriptionInfo> =
    new Map();

  constructor(public navigate: Navigate) {
    super();
  }

  build() {
    const anchor = document.createElement("div");
    anchor.style.position = "relative";
    anchor.style.width = "100%";
    anchor.style.height = "100%";

    const subscription = this.navigate.pages.subscribe((pages) => {
      this.renderPages(anchor, pages);
    });

    this.pushDrop(() => subscription.unsubscribe());
    this.pushDrop(() => {
      this.activeStreamSubscriptions.forEach((info) => {
        info.subscription.unsubscribe();
      });
      this.activeStreamSubscriptions.clear();
    });

    return anchor;
  }

  private renderPages(
    anchor: HTMLElement,
    pages: Array<{ content: any; isOverlay: boolean; route?: string }>,
  ) {
    // Find the base page (last non-overlay page <= cursor)
    let baseIndex = this.navigate.cursor;
    while (baseIndex > 0 && pages[baseIndex]?.isOverlay) {
      baseIndex--;
    }

    // Clear anchor
    anchor.replaceChildren();

    // Render base page
    if (pages[baseIndex]) {
      const baseContainer = document.createElement("div");
      baseContainer.className = "base-page";
      baseContainer.style.width = "100%";
      baseContainer.style.height = "100%";
      this.renderPage(baseContainer, pages[baseIndex].content, baseIndex);
      anchor.appendChild(baseContainer);
    }

    // Render all overlays from baseIndex+1 to cursor
    for (let i = baseIndex + 1; i <= this.navigate.cursor; i++) {
      if (pages[i] && pages[i].isOverlay) {
        const overlayContainer = document.createElement("div");
        overlayContainer.className = "overlay";
        overlayContainer.style.position = "fixed";
        overlayContainer.style.inset = "0";
        overlayContainer.style.zIndex = String(1000 + (i - baseIndex));

        this.renderPage(overlayContainer, pages[i].content, i);
        anchor.appendChild(overlayContainer);
      }
    }

    // Clean up subscriptions for pages that are no longer visible
    const visibleIndices = new Set<number>();
    visibleIndices.add(baseIndex);
    for (let i = baseIndex + 1; i <= this.navigate.cursor; i++) {
      if (pages[i]?.isOverlay) {
        visibleIndices.add(i);
      }
    }

    this.activeStreamSubscriptions.forEach((info, index) => {
      if (!visibleIndices.has(index)) {
        info.subscription.unsubscribe();
        this.activeStreamSubscriptions.delete(index);
      }
    });
  }

  private renderPage(container: HTMLElement, content: any, index: number) {
    // Clean up existing subscription for this index if it exists
    const existing = this.activeStreamSubscriptions.get(index);
    if (existing) {
      existing.subscription.unsubscribe();
      this.activeStreamSubscriptions.delete(index);
    }

    if (!content) {
      container.replaceChildren();
      return;
    }

    if (this.isObservable(content)) {
      this.renderStream(container, content as Observable<JSX.Element>, index);
    } else {
      container.replaceChildren(content as any);
    }
  }

  private renderStream(
    container: HTMLElement,
    stream: Observable<JSX.Element>,
    index: number,
  ) {
    const root = document.createElement("div");
    root.style.width = "100%";
    root.style.height = "100%";
    container.replaceChildren(root);

    const osc = new OSC(root);

    const subscription = stream.subscribe(
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
        container.innerHTML = `<div>Error loading page: ${error.message}</div>`;
        this.activeStreamSubscriptions.delete(index);
      },
      () => {
        const resolvedElement = osc.tree.dom;
        this.navigate.resolveStream(index, resolvedElement);
        this.activeStreamSubscriptions.delete(index);
      },
    );

    this.activeStreamSubscriptions.set(index, { subscription, index });
  }

  private isObservable(obj: any): obj is Observable<any> {
    return obj && typeof obj.subscribe === "function";
  }
}
