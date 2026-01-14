import { parseHTML } from "linkedom";
import { isClassComponent, isFragment, isIntrinsicElement, JSX } from "../jsx";
import { Injector, ProviderNormalizer } from "../module";
import {
  COMPONENT,
  COMPONENT_PROVIDERS,
  ERROR_ELEMENT,
  ORCA_ELEMENT_TYPE,
  PENDING_REFERENCE_TYPE,
} from "../symbols";
import { Constructor, Provider } from "../types";

interface PendingEntry {
  abortController: AbortController;
  promise: Promise<any>;
}

export interface StreamRendererOptions {
  timeout?: number;
}

export class StreamRenderer {
  private options: Required<StreamRendererOptions>;
  private pending = new Map<string, PendingEntry>();
  private processedIds = new Set<string>();
  private queueResolvers: ((u: JSX.Element) => void)[] = [];
  private renderingNodes!: WeakSet<object>;
  private idCounter = 0;

  constructor(
    private rootInjector: Injector,
    options: StreamRendererOptions = {}
  ) {
    this.options = {
      timeout: options.timeout ?? 30000,
    };
  }

  render(
    vnode: JSX.Element,
    parentInjector: Injector = this.rootInjector
  ): any {
    return this.stream(vnode, parentInjector);
  }

  private async *stream(vnode: JSX.Element, parentInjector: Injector) {
    this.pending.clear();
    this.queueResolvers = [];
    this.renderingNodes = new WeakSet();
    this.processedIds.clear();

    const nextUpdate = () =>
      new Promise<JSX.Element>((resolve) => this.queueResolvers.push(resolve));

    try {
      const root = this.buildSyncTree(vnode, parentInjector);
      yield { ...root, action: "insert" };

      while (this.pending.size > 0) {
        const update = await nextUpdate();
        yield update;
      }
    } finally {
      this.cleanup();
    }
  }

  private buildSyncTree(vnode: JSX.Element, injector: Injector): any {
    if (vnode == null || typeof vnode !== "object") return vnode;
    if (vnode.$$typeof !== ORCA_ELEMENT_TYPE) return vnode;

    if (this.renderingNodes.has(vnode)) {
      throw new Error(
        `Circular reference detected while rendering component "${vnode.type?.name}".`
      );
    }

    this.renderingNodes.add(vnode);

    try {
      if (isClassComponent(vnode)) {
        return this.renderClassComponent(vnode, injector);
      }

      if (isIntrinsicElement(vnode)) {
        return this.renderIntrinsicElement(vnode, injector);
      }

      if (isFragment(vnode)) {
        return {
          $$typeof: ORCA_ELEMENT_TYPE,
          type: null,
          id: vnode.id,
          props: {
            children: this.mapChildren(vnode.props?.children, injector),
          },
          key: null,
        };
      }

      return vnode;
    } finally {
      this.renderingNodes.delete(vnode);
    }
  }

  private renderIntrinsicElement(vnode: JSX.Element, injector: Injector): any {
    const { dangerouslySetInnerHTML, children, ...restProps } =
      vnode.props || {};

    let processedChildren;

    if (dangerouslySetInnerHTML?.__html) {
      processedChildren = this.parseHTMLToJSX(
        dangerouslySetInnerHTML.__html,
        injector
      );
    } else {
      processedChildren = this.mapChildren(children, injector);
    }

    if (vnode.type == "a" && restProps["href"]) {
      const href = restProps["href"];

      try {
        new URL(href);
      } catch {
        if (
          !href.startsWith("#") &&
          !href.startsWith("mailto:") &&
          !href.startsWith("tel:")
        ) {
          restProps["onclick"] = `Orca.navigate(event, '${href}')`;
        }
      }
    }

    return {
      $$typeof: ORCA_ELEMENT_TYPE,
      type: vnode.type,
      id: vnode.id,
      props: {
        ...restProps,
        children: processedChildren,
      },
      key: vnode.key ?? null,
    };
  }

  private renderClassComponent(vnode: JSX.Element, injector: Injector): any {
    const ComponentClass = vnode.type;
    const isComponent = Reflect.getMetadata(COMPONENT, ComponentClass);

    let componentInjector = injector;

    if (isComponent) {
      const localProviders: (Provider | Constructor)[] =
        Reflect.getMetadata(COMPONENT_PROVIDERS, ComponentClass) || [];

      if (localProviders.length > 0) {
        componentInjector = new Injector(
          localProviders.map((p) => ProviderNormalizer.normalize(p)),
          injector
        );
      }
    }

    const instance: any = componentInjector.resolve(ComponentClass);
    instance.props = vnode.props || {};

    const childVNode = instance.build();

    if (childVNode instanceof Promise) {
      return this.createPendingReference(vnode, childVNode, componentInjector);
    }

    return this.buildSyncTree(childVNode, componentInjector);
  }

  private mapChildren(children: any, injector: Injector): any {
    if (children == null) return undefined;
    if (typeof children === "string" || typeof children === "number") {
      return children;
    }

    if (Array.isArray(children)) {
      return children.map((c) => this.buildSyncTree(c, injector));
    }

    return this.buildSyncTree(children, injector);
  }

  private parseHTMLToJSX(html: string, injector: Injector): any {
    const { document } = parseHTML(
      `<!doctype html><html><body>${html}</body></html>`
    );

    const convertElement = (element: any): any => {
      const tagName = element.tagName.toLowerCase();
      const props: Record<string, any> = {};

      const attrs = element.attributes;
      if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
          const attr = attrs[i];
          let name = attr.name;

          if (name === "class") {
            name = "className";
          } else if (name === "for") {
            name = "htmlFor";
          } else if (
            !name.startsWith("data-") &&
            !name.startsWith("aria-") &&
            name.includes("-")
          ) {
            name = name.replace(/-([a-z])/g, (_: string, letter: string) =>
              letter.toUpperCase()
            );
          }

          props[name] = attr.value;
        }
      }

      const children: any[] = [];
      const childNodes = element.childNodes;

      if (childNodes) {
        for (let i = 0; i < childNodes.length; i++) {
          const child = childNodes[i];
          const converted = convertNode(child);
          if (converted != null) {
            children.push(converted);
          }
        }
      }

      const jsxElement = {
        $$typeof: ORCA_ELEMENT_TYPE,
        type: tagName,
        id: this.generateId(),
        props: {
          ...props,
          children:
            children.length === 0
              ? undefined
              : children.length === 1
              ? children[0]
              : children,
        },
        key: null,
      };

      return this.buildSyncTree(jsxElement, injector);
    };

    const convertNode = (node: any): any => {
      if (node.nodeType === 3) {
        const text = node.textContent || "";
        const trimmed = text.trim();
        return trimmed ? text : null;
      }

      if (node.nodeType === 1) {
        return convertElement(node);
      }

      return null;
    };

    const result: any[] = [];
    const bodyChildren = document.body?.childNodes;

    if (bodyChildren) {
      for (let i = 0; i < bodyChildren.length; i++) {
        const node = bodyChildren[i];
        const converted = convertNode(node);
        if (converted != null) {
          result.push(converted);
        }
      }
    }

    return result.length === 0
      ? undefined
      : result.length === 1
      ? result[0]
      : result;
  }

  private createPendingReference(
    vnode: JSX.Element,
    promise: Promise<any>,
    injector: Injector
  ) {
    const id = vnode.id;
    const abortController = new AbortController();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        reject(
          new Error(
            `Component ${vnode.type.name || "Unknown"} timed out after ${
              this.options.timeout
            }ms`
          )
        );
      }, this.options.timeout);

      abortController.signal.addEventListener("abort", () => {
        clearTimeout(timeoutId);
      });
    });

    const raced = Promise.race([promise, timeoutPromise])
      .then((result) => {
        result.id = vnode.id;
        return this.buildSyncTree(result, injector);
      })
      .catch((err) => Promise.reject({ id, error: err }));

    this.pending.set(id, { abortController, promise: raced });

    raced
      .then((resolved) => {
        if (this.processedIds.has(id)) return;
        this.processedIds.add(id);

        this.queueResolvers.shift()?.({
          ...resolved,
          action: "update",
        });

        this.pending.delete(id);
      })
      .catch((e) => {
        this.queueResolvers.shift()?.({
          $$typeof: ERROR_ELEMENT,
          type: "error",
          action: "error",
          id,
          props: {
            message: String(e?.error) || String(e),
          },
          key: null,
        });
        this.pending.delete(id);
      });

    return {
      $$typeof: PENDING_REFERENCE_TYPE,
      id,
      type: "ref",
      props: vnode.props,
      key: vnode.key ?? null,
    };
  }

  private generateId(): string {
    return `jsx_${++this.idCounter}`;
  }

  private cleanup() {
    for (const { abortController } of this.pending.values()) {
      abortController.abort();
    }
    this.pending.clear();
    this.processedIds.clear();
    this.queueResolvers.length = 0;
  }

  cancel() {
    this.cleanup();
  }

  async renderToCompletion(jsx: JSX.Element): Promise<JSX.Element[]> {
    const out: JSX.Element[] = [];
    for await (const upd of this.stream(jsx, this.rootInjector)) {
      out.push(upd);
    }
    return out;
  }
}
