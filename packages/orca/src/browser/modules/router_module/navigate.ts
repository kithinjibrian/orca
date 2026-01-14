import {
  BehaviorSubject,
  HttpClient,
  Inject,
  JSX,
  Observable,
  symbolValueReviver,
} from "@/shared";

type Page = Node | JSX.Element | Observable<JSX.Element>;

interface StoredState {
  routes: string[];
  cursor: number;
}

export class Navigate {
  public pages: BehaviorSubject<Page[]>;
  public cursor: number = 0;
  private readonly STORAGE_KEY = "navigate_stack";

  constructor(@Inject("OSC_URL", { maybe: true }) private oscUrl: string) {
    const savedState = this.loadFromStorage();
    const historyCursor = history.state?.cursor;

    if (savedState && historyCursor !== undefined) {
      this.cursor = historyCursor;
      const restoredPages: Page[] = savedState.routes.map(() => null as any);

      const currentRoute = window.location.pathname + window.location.search;
      const stream = this.createStreamForRoute(currentRoute);
      restoredPages[this.cursor] = stream;

      this.pages = new BehaviorSubject<Page[]>(restoredPages);
    } else {
      const initialStream = this.createStreamForCurrentUrl();
      this.pages = new BehaviorSubject<Page[]>([initialStream]);
      this.cursor = 0;
      history.replaceState({ cursor: 0 }, "");
      this.saveToStorage();
    }

    window.addEventListener("popstate", (e) => {
      const newCursor = e.state?.cursor ?? 0;
      this.cursor = newCursor;

      const currentPages = [...(this.pages.$value || [])];

      if (!currentPages[newCursor]) {
        const savedState = this.loadFromStorage();
        const route =
          savedState?.routes[newCursor] ||
          window.location.pathname + window.location.search;
        const stream = this.createStreamForRoute(route);
        currentPages[newCursor] = stream;
      }

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
      const currentPages = this.pages.$value || [];
      const routes = currentPages.map((page, index) => {
        if (page && typeof page === "object" && "__route" in page) {
          return (page as any).__route as string;
        }

        const savedState = this.loadFromStorage();
        return savedState?.routes[index] || "";
      });

      const state: StoredState = {
        routes,
        cursor: this.cursor,
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  private createStreamForRoute(route: string): Observable<JSX.Element> {
    const http = new HttpClient();
    let url = this.oscUrl;

    if (route && route !== "/") {
      url = `${this.oscUrl}?c=${encodeURIComponent(route)}`;
    }

    return http.post<JSX.Element>(url, {
      stream: "ndjson",
      reviver: symbolValueReviver,
    });
  }

  private createStreamForCurrentUrl(): Observable<JSX.Element> {
    const path = window.location.pathname;
    const search = window.location.search;
    const fullPath = search ? `${path}${search}` : path;
    return this.createStreamForRoute(fullPath);
  }

  public go(path: string): void {
    const stream = this.createStreamForRoute(path);
    (stream as any).__route = path;
    this.push(stream);
  }

  public push(item: Page): void {
    const currentPages = this.pages.$value || [];
    const newPages = currentPages.slice(0, this.cursor + 1);

    let route = "";
    if (item && typeof item === "object" && "__route" in item) {
      route = (item as any).__route as string;
    }

    this.cursor++;
    newPages.push(item);
    history.pushState({ cursor: this.cursor }, "", route);
    this.pages.next(newPages);
    this.saveToStorage();
  }

  public replace(item: Page): void {
    const currentPages = [...(this.pages.$value || [])];
    currentPages[this.cursor] = item;
    history.replaceState({ cursor: this.cursor }, "");
    this.pages.next(currentPages);
    this.saveToStorage();
  }

  public resolveStream(index: number, element: Node): void {
    const currentPages = [...(this.pages.$value || [])];
    if (index >= 0 && index < currentPages.length) {
      currentPages[index] = element;
      this.pages.next(currentPages);
    }
  }

  public goBack(): void {
    if (this.canGoBack()) {
      history.back();
    }
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
    const currentPages = this.pages.$value || [];
    return this.cursor < currentPages.length - 1;
  }

  public getCurrentPage(): Page | undefined {
    const currentPages = this.pages.$value || [];
    return currentPages[this.cursor];
  }

  public clear(): void {
    this.cursor = 0;
    const initialStream = this.createStreamForCurrentUrl();
    this.pages.next([initialStream]);
    history.replaceState({ cursor: 0 }, "");
    this.saveToStorage();
  }
}
