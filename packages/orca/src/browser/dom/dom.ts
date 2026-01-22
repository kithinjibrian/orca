import {
  COMPONENT,
  COMPONENT_PROVIDERS,
  COMPONENT_ROUTE,
  Constructor,
  getCurrentInjector,
  Injector,
  OrcaComponent,
  Provider,
  ProviderNormalizer,
} from "@/shared";
import { effect, isSignal } from "../../shared/signal";

const elementEffects = new WeakMap<Node, Array<() => void>>();

const cleanupObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.removedNodes.forEach((node) => {
      cleanupElement(node);
    });
  });
});

if (typeof document !== "undefined" && document.body) {
  cleanupObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
} else if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    cleanupObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

function cleanupElement(node: Node): void {
  const cleanups = elementEffects.get(node);

  if (cleanups) {
    cleanups.forEach((cleanup, idx) => {
      cleanup();
    });
    elementEffects.delete(node);
  }

  if (node.childNodes && node.childNodes.length > 0) {
    node.childNodes.forEach((child) => cleanupElement(child));
  }
}

function registerEffect(el: Node, cleanup: () => void) {
  if (!elementEffects.has(el)) {
    elementEffects.set(el, []);
  }
  elementEffects.get(el)!.push(cleanup);
}

function buildDOM(value: any): Node {
  if (value instanceof Node) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return document.createTextNode(String(value));
  }
  if (value == null || typeof value === "boolean") {
    return document.createTextNode("");
  }

  if (Array.isArray(value)) {
    const fragment = document.createDocumentFragment();
    for (const item of value) {
      const node = buildDOM(item);
      fragment.appendChild(node);
    }
    return fragment;
  }
  console.log("Unhandled value:", value);
  throw new Error(`Cannot build DOM from value: ${value}`);
}

export function insert(parent: Node, value: any): void {
  if (value == null) return;

  let currentDOM: Node | Node[] | undefined;

  function attach(value: any) {
    const newDOM = buildDOM(value);

    if (currentDOM) {
      if (Array.isArray(currentDOM)) {
        currentDOM.forEach((node) => {
          if (node.parentNode) {
            node.parentNode.removeChild(node);
          }
        });
      } else {
        if (currentDOM.parentNode) {
          currentDOM.parentNode.removeChild(currentDOM);
        }
      }
    }

    if (newDOM instanceof DocumentFragment) {
      const nodes = Array.from(newDOM.childNodes);
      parent.appendChild(newDOM);
      currentDOM = nodes;
    } else {
      parent.appendChild(newDOM);
      currentDOM = newDOM;
    }
  }

  if (isSignal(value)) {
    const cleanup = effect(() => {
      attach(value.value);
    });

    registerEffect(parent, cleanup);
  } else if (typeof value == "function") {
    const cleanup = effect(() => {
      attach(value());
    });

    registerEffect(parent, cleanup);
  } else {
    const node = buildDOM(value);
    parent.appendChild(node);
  }
}

function autoCleanup(element: Node, callback: Function) {
  const observer = new MutationObserver(() => {
    if (!document.contains(element)) {
      callback();
      observer.disconnect();
    }
  });

  setTimeout(() => {
    if (element.parentNode) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }, 0);
}

export function createComponent(
  ComponentClass: Constructor,
  props: any = {},
  parentComponent: OrcaComponent,
) {
  let injector = getCurrentInjector();
  if (!injector) {
    throw new Error(
      `Cannot create component ${ComponentClass.name} outside injection context. ` +
        `No injector available from current context or parent component.`,
    );
  }

  const isComponent = Reflect.getMetadata(COMPONENT, ComponentClass);
  if (!isComponent) {
    throw new Error(
      `${ComponentClass.name} is not decorated with @Component()`,
    );
  }

  let instance: OrcaComponent;
  try {
    instance = injector.resolve(ComponentClass);
  } catch (e: any) {
    console.log(e);

    throw new Error(
      `Failed to resolve component ${ComponentClass.name}: ${e.message}`,
    );
  }

  const localProviders: (Provider | Constructor)[] =
    Reflect.getMetadata(COMPONENT_PROVIDERS, ComponentClass) || [];

  if (localProviders.length > 0) {
    injector = new Injector(
      localProviders.map((p) => ProviderNormalizer.normalize(p)),
      parentComponent.__injector || injector,
    );
    instance.__injector = injector;
  } else {
    instance.__injector = injector;
  }

  const routePattern = Reflect.getMetadata(COMPONENT_ROUTE, ComponentClass);

  let builtRoute: string | null = null;
  if (routePattern) {
    builtRoute = buildRouteFromProps(routePattern, props, ComponentClass.name);
  }

  const mergedProps = Object.create(
    Object.getPrototypeOf(instance.props || {}),
  );

  Object.defineProperties(
    mergedProps,
    Object.getOwnPropertyDescriptors(instance.props),
  );

  Object.defineProperties(mergedProps, Object.getOwnPropertyDescriptors(props));

  instance.props = mergedProps;

  instance.onInit?.();

  const root = instance.build();
  if (!(root instanceof Node)) {
    throw new Error(
      `Component ${ComponentClass.name}.build() must return a DOM Node`,
    );
  }

  (root as any).__route = builtRoute;

  const cleanup = () => {
    instance.__cleanup?.forEach((cb) => cb());
    instance.onDestroy?.();
  };

  if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    const firstChild = root.firstChild;
    if (firstChild) {
      autoCleanup(firstChild, cleanup);
    }
  } else {
    autoCleanup(root, cleanup);
  }

  return root;
}

function buildRouteFromProps(
  routePattern: string,
  props: any,
  componentName: string,
): string {
  const [pathPattern, queryPattern] = routePattern.split("?");

  let path = pathPattern;
  const pathParams = pathPattern.match(/:(\w+)/g);

  if (pathParams) {
    for (const param of pathParams) {
      const paramName = param.slice(1);
      const paramValue = props[paramName];

      if (paramValue === undefined || paramValue === null) {
        throw new Error(
          `Missing required prop "${paramName}" for route parameter in component ${componentName}. ` +
            `Route pattern: "${routePattern}"`,
        );
      }

      path = path.replace(param, encodeURIComponent(String(paramValue)));
    }
  }

  if (queryPattern) {
    const queryParams = queryPattern.split("&").filter(Boolean);
    const queryParts: string[] = [];

    for (const param of queryParams) {
      const isOptional = param.endsWith("*");
      const paramName = isOptional ? param.slice(0, -1) : param;

      const paramValue = props[paramName];

      if (paramValue === undefined || paramValue === null) {
        if (!isOptional) {
          throw new Error(
            `Missing required prop "${paramName}" for query parameter in component ${componentName}. ` +
              `Route pattern: "${routePattern}"`,
          );
        }
        continue;
      }

      queryParts.push(
        `${encodeURIComponent(paramName)}=${encodeURIComponent(
          String(paramValue),
        )}`,
      );
    }

    if (queryParts.length > 0) {
      path += "?" + queryParts.join("&");
    }
  }

  return path;
}

export function style(
  el: HTMLElement,
  styleObj: Record<string, any> | (() => Record<string, any>),
): void {
  if (typeof styleObj === "function") {
    const cleanup = effect(() => {
      const styles = styleObj();
      if (!styles) return;

      for (const key in styles) {
        const value = styles[key];
        const actualValue = isSignal(value) ? value.value : value;
        const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        el.style.setProperty(cssKey, actualValue);
      }
    });

    registerEffect(el, cleanup);
    return;
  }

  if (!styleObj) return;
  for (const key in styleObj) {
    const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    el.style.setProperty(cssKey, styleObj[key]);
  }
}

export function spread(el: Element, attrs: Record<string, any>): void {
  if (!attrs) return;
  for (const key in attrs) {
    const value = attrs[key];

    if (/^on[A-Z]/.test(key)) {
      const eventName = key.slice(2).toLowerCase();
      el.addEventListener(eventName, value);
      continue;
    }

    if (key === "style" && typeof value === "object") {
      style(el as HTMLElement, value);
      continue;
    }

    const attrName = key === "className" ? "class" : key;
    el.setAttribute(attrName, value);
  }
}
