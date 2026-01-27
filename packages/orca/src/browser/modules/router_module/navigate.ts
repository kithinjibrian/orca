import { HttpClient, Inject, JSX, symbolValueReviver } from "@/shared";
import { BehaviorSubject, Observable } from "rxjs";

type Page = Node | JSX.Element | Observable<JSX.Element>;

interface RouteEntry {
  content: Page;
  isOverlay: boolean;
  route?: string;
}

interface StoredState {
  routes: Array<{
    path: string;
    isOverlay: boolean;
  }>;
  cursor: number;
}

export class Navigate {
  public pages: BehaviorSubject<RouteEntry[]>;
  public cursor: number = 0;
  private readonly STORAGE_KEY = "navigate_stack";

  constructor(@Inject("OSC_URL", { maybe: true }) private oscUrl: string) {
    const savedState = this.loadFromStorage();
    const historyCursor = history.state?.cursor;

    if (
      savedState &&
      historyCursor !== undefined &&
      savedState.routes[historyCursor]
    ) {
      this.cursor = historyCursor;

      const restoredPages: RouteEntry[] = savedState.routes.map(
        (routeData, idx) => ({
          content:
            idx === this.cursor
              ? this.createStreamForRoute(routeData.path)
              : (null as any),
          isOverlay: routeData.isOverlay,
          route: routeData.path,
        }),
      );

      this.pages = new BehaviorSubject<RouteEntry[]>(restoredPages);
    } else {
      const initialPath = window.location.pathname + window.location.search;
      const initialStream = this.createStreamForRoute(initialPath);

      this.cursor = 0;
      this.pages = new BehaviorSubject<RouteEntry[]>([
        {
          content: initialStream,
          isOverlay: false,
          route: initialPath,
        },
      ]);

      history.replaceState({ cursor: 0 }, "", initialPath);
      this.saveToStorage();
    }

    this.initListeners();
  }

  private initListeners(): void {
    window.addEventListener("popstate", (e) => {
      const newCursor = e.state?.cursor ?? 0;
      const currentPages = [...this.pages.value];

      if (currentPages[newCursor] && !currentPages[newCursor].content) {
        const route =
          currentPages[newCursor].route ||
          window.location.pathname + window.location.search;
        currentPages[newCursor].content = this.createStreamForRoute(route);
      }

      this.cursor = newCursor;
      this.pages.next(currentPages);
    });
  }

  private loadFromStorage(): StoredState | null {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  private saveToStorage(): void {
    try {
      const state: StoredState = {
        routes: this.pages.value.map((p) => ({
          path: p.route || "",
          isOverlay: p.isOverlay,
        })),
        cursor: this.cursor,
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Navigation persistence failed", e);
    }
  }

  private createStreamForRoute(route: string): Observable<JSX.Element> {
    const http = new HttpClient();
    let url = this.oscUrl;

    if (route && route !== "/") {
      const separator = url.includes("?") ? "&" : "?";
      url = `${url}${separator}c=${encodeURIComponent(route)}`;
    }

    return http.post<JSX.Element>(url, {
      stream: "ndjson",
      reviver: symbolValueReviver,
    });
  }

  public go(path: string): void {
    const stream = this.createStreamForRoute(path);

    (stream as any).__route = path;

    this.push(stream, false);
  }

  public push(item: Page, isOverlay: boolean = false): void {
    const currentPages = this.pages.value || [];

    const newPages = currentPages.slice(0, this.cursor + 1);

    let route = "";
    if (item && typeof item === "object" && "__route" in item) {
      route = (item as any).__route as string;
    }

    this.cursor++;
    newPages.push({
      content: item,
      isOverlay,
      route,
    });

    history.pushState({ cursor: this.cursor }, "", route || undefined);
    this.pages.next(newPages);
    this.saveToStorage();
  }

  public pushOverlay(item: Page): void {
    this.push(item, true);
  }

  public pop(): void {
    if (this.canGoBack()) {
      history.back();
    }
  }

  public replace(item: Page): void {
    const currentPages = [...(this.pages.value || [])];
    if (currentPages[this.cursor]) {
      currentPages[this.cursor].content = item;
      this.pages.next(currentPages);
      this.saveToStorage();
    }
  }

  public resolveStream(index: number, element: Node): void {
    const currentPages = [...(this.pages.value || [])];
    if (index >= 0 && index < currentPages.length) {
      currentPages[index].content = element;
      this.pages.next(currentPages);
    }
  }

  public goBack(): void {
    this.pop();
  }

  public goForward(): void {
    if (this.canGoForward()) {
      history.forward();
    }
  }

  public canGoBack(): boolean {
    return this.cursor > 0;
  }

  public canGoForward(): boolean {
    return this.cursor < (this.pages.value?.length || 0) - 1;
  }

  public getCurrentPage(): RouteEntry | undefined {
    return this.pages.value[this.cursor];
  }

  public clear(): void {
    this.cursor = 0;
    const initialPath = window.location.pathname + window.location.search;
    const initialStream = this.createStreamForRoute(initialPath);

    this.pages.next([
      {
        content: initialStream,
        isOverlay: false,
        route: initialPath,
      },
    ]);

    history.replaceState({ cursor: 0 }, "");
    this.saveToStorage();
  }
}
