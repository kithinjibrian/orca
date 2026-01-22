import {
  COMPONENT_DEPS,
  Constructor,
  DESIGN_PARAMTYPES,
  getCurrentInjector,
  Injector,
  isIntrinsicElement,
  JSX,
  ORCA_CLIENT_COMPONENT,
  PENDING_REFERENCE_TYPE,
  VNode,
} from "@/shared";

interface BuildResult {
  domNode: Node;
  vnode?: VNode;
}

export class OSC {
  public tree: VNode;
  private pendingRefs = new Map<string, JSX.Element>();
  private static readonly SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  private static readonly SVG_TAGS = new Set([
    "svg",
    "circle",
    "rect",
    "line",
    "path",
    "polygon",
    "polyline",
    "ellipse",
    "text",
    "tspan",
    "g",
    "defs",
    "use",
    "symbol",
    "marker",
    "clipPath",
    "mask",
    "pattern",
    "linearGradient",
    "radialGradient",
    "stop",
    "animate",
    "animateTransform",
    "foreignObject",
    "image",
    "textPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "filter",
    "metadata",
    "title",
    "desc",
    "switch",
    "view",
  ]);

  constructor(private root: HTMLElement) {
    this.tree = new VNode(root, (old, nw) => {
      (old as HTMLElement).replaceWith(nw);
    });
  }

  public handleInsert(jsx: JSX.Element): void {
    const { domNode, vnode } = this.buildDOM(jsx, this.tree);

    if (jsx.id && vnode) {
      vnode.setId(jsx.id);
    }

    this.tree.attach(domNode);
  }

  public handleUpdate(jsx: JSX.Element): void {
    if (!jsx.id) {
      console.warn("Update action requires an id");
      return;
    }

    const targetVNode = this.tree.findById(jsx.id);

    if (targetVNode) {
      const oldChildren = [...targetVNode.children];
      targetVNode.children = [];

      const { domNode, vnode } = this.buildDOM(
        jsx,
        targetVNode.parent || this.tree,
      );

      targetVNode.attach(domNode);

      if (vnode) {
        targetVNode.children = vnode.children;
      }
    } else {
      console.warn(`Update target ${jsx.id} not found, inserting instead`);
      this.handleInsert(jsx);
    }
  }

  private buildDOM(
    jsx: JSX.Element | JSX.Element[],
    vparent: VNode,
  ): BuildResult {
    if (jsx == null) {
      return { domNode: document.createDocumentFragment() };
    }

    if (Array.isArray(jsx)) {
      return this.buildArray(jsx, vparent);
    }

    if (this.isPrimitive(jsx)) {
      return this.buildTextNode(String(jsx), vparent);
    }

    if (jsx.$$typeof === PENDING_REFERENCE_TYPE) {
      return this.buildPendingReference(jsx, vparent);
    }

    if (jsx.$$typeof === ORCA_CLIENT_COMPONENT) {
      return this.buildClientComponent(jsx, vparent);
    }

    if (isIntrinsicElement(jsx)) {
      return this.buildIntrinsicElement(jsx, vparent);
    }

    console.error("Unsupported node:", jsx);
    throw new Error(
      `Unsupported node type: ${typeof jsx}, $typeof: ${String(jsx.$$typeof)}`,
    );
  }

  private buildClientComponent(jsx: any, parent: VNode): BuildResult {
    const componentInfo = jsx.props.__clientComponent;
    const { id, path, name } = componentInfo;

    const container = document.createElement("div");
    container.dataset.clientComponent = id;

    const vnode = new VNode(container, (old, nw) => {
      if (old.parentNode) {
        old.parentNode.replaceChild(nw, old);
      }
    });

    if (jsx.id) {
      vnode.setId(jsx.id);
    }

    parent.addChild(vnode);

    this.loadClientComponent(path, name, jsx.props, container);

    return { domNode: container, vnode };
  }

  private buildPendingReference(jsx: any, parent: VNode): BuildResult {
    const refId = jsx.id;
    const div = document.createElement("div");
    div.dataset.ref = refId;
    div.className = "loading";
    div.textContent = "Loading...";

    const vnode = new VNode(div, (old, nw) => {
      if (old.parentNode) {
        old.parentNode.replaceChild(nw, old);
      }
    });
    vnode.setId(refId);
    parent.addChild(vnode);

    const pendingContent = this.pendingRefs.get(refId);
    if (pendingContent) {
      setTimeout(() => this.resolvePendingReference(refId, pendingContent), 0);
    }

    return { domNode: div, vnode };
  }

  resolvePendingReference(refId: string, content: JSX.Element): void {
    const vnode = this.tree.findById(refId);
    if (!vnode) {
      console.warn(`Reference ${refId} not found`);
      this.pendingRefs.set(refId, content);
      return;
    }

    try {
      vnode.children = [];

      const { domNode, vnode: newVNode } = this.buildDOM(content, vnode);

      vnode.attach(domNode);

      if (newVNode) {
        vnode.children = newVNode.children;
      }

      this.pendingRefs.delete(refId);
    } catch (error) {
      console.error(`Error resolving reference ${refId}:`, error);
    }
  }

  private buildTextNode(text: string, parent: VNode): BuildResult {
    const textNode = document.createTextNode(text);
    const vnode = new VNode(textNode, (old, nw) => {
      if (old.parentNode) {
        old.parentNode.replaceChild(nw, old);
      }
    });
    parent.addChild(vnode);
    return { domNode: textNode, vnode };
  }

  private isPrimitive(node: any): boolean {
    return (
      typeof node === "string" ||
      typeof node === "number" ||
      typeof node === "boolean"
    );
  }

  private buildArray(nodes: JSX.Element[], parent: VNode): BuildResult {
    const fragment = document.createDocumentFragment();
    const vnodes: VNode[] = [];

    nodes.forEach((child) => {
      const { domNode, vnode } = this.buildDOM(child, parent);
      fragment.appendChild(domNode);
      if (vnode) {
        vnodes.push(vnode);
      }
    });

    return { domNode: fragment };
  }

  private isSVGTag(tag: string): boolean {
    return OSC.SVG_TAGS.has(tag);
  }

  private buildIntrinsicElement(jsx: JSX.Element, parent: VNode): BuildResult {
    const tag = jsx.type;
    const isSVG = this.isSVGTag(tag);

    // Create element with proper namespace for SVG
    const dom = isSVG
      ? document.createElementNS(OSC.SVG_NAMESPACE, tag)
      : document.createElement(tag);

    const vnode = new VNode(dom, (old, nw) => {
      if (old.parentNode) {
        old.parentNode.replaceChild(nw, old);
      }
    });

    parent.addChild(vnode);

    if (jsx.id) {
      vnode.setId(jsx.id);
    }

    if (jsx.props) {
      this.buildAttributes(jsx.props, dom, vnode, isSVG);
    }

    if (jsx.props?.children != null) {
      const { domNode: childDom } = this.buildDOM(jsx.props.children, vnode);
      dom.appendChild(childDom);
    }

    return { domNode: dom, vnode };
  }

  private buildAttributes(
    props: Record<string, any>,
    dom: Element,
    vnode: VNode,
    isSVG: boolean = false,
  ): void {
    for (const [key, value] of Object.entries(props)) {
      if (key === "children" || value == null) {
        continue;
      }

      const attrKey = this.normalizeAttributeKey(key);

      if (attrKey === "style" && typeof value === "object") {
        this.applyStyles(value, dom as HTMLElement);
        continue;
      }

      if (typeof value === "boolean") {
        this.setBooleanAttribute(attrKey, value, dom, isSVG);
        continue;
      }

      // For SVG elements, use setAttributeNS for certain attributes
      if (isSVG) {
        this.setSVGAttribute(attrKey, String(value), dom);
      } else {
        dom.setAttribute(attrKey, String(value));
      }
    }
  }

  private setSVGAttribute(key: string, value: string, dom: Element): void {
    // SVG href attributes need the xlink namespace
    if (key === "href" || key === "xlink:href") {
      dom.setAttributeNS("http://www.w3.org/1999/xlink", "href", value);
    } else {
      dom.setAttribute(key, value);
    }
  }

  private normalizeAttributeKey(key: string): string {
    if (key === "className") return "class";
    if (key === "htmlFor") return "for";
    return key;
  }

  private applyStyles(styles: Record<string, any>, dom: HTMLElement): void {
    const styleString = Object.entries(styles)
      .map(([k, v]) => {
        const kebabKey = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        return `${kebabKey}:${v}`;
      })
      .join(";");
    dom.setAttribute("style", styleString);
  }

  private setBooleanAttribute(
    key: string,
    value: boolean,
    dom: Element,
    isSVG: boolean = false,
  ): void {
    if (value) {
      dom.setAttribute(key, "");
    } else {
      dom.removeAttribute(key);
    }
  }

  private async loadClientComponent(
    path: string,
    name: string,
    props: Record<string, any>,
    container: HTMLElement,
  ): Promise<void> {
    try {
      const module = await import(path);
      const ComponentClass: Constructor = module[name];

      if (!ComponentClass) {
        throw new Error(`Component ${name} not found in ${path}`);
      }

      const injector = getCurrentInjector();
      if (injector == null) {
        throw new Error("Couldn't find an injector");
      }

      const seen = new Set<Constructor>();

      function register(Cls: Constructor, injector: Injector) {
        if (seen.has(Cls)) return;
        seen.add(Cls);

        injector.addProvider({
          provide: Cls,
          useClass: Cls,
          scope: "transient",
        });

        const paramDeps: Constructor[] =
          Reflect.getMetadata(DESIGN_PARAMTYPES, Cls) ?? [];

        const explicitDeps: Constructor[] =
          Reflect.getMetadata(COMPONENT_DEPS, Cls) ?? [];

        paramDeps
          .filter((d) => d && d !== Object)
          .forEach((d) => injector.addProvider(d));

        explicitDeps.forEach((deps) => register(deps, injector));
      }

      register(ComponentClass, injector);

      const cleanProps = { ...props };
      delete cleanProps.__clientComponent;

      const instance = injector.resolve(ComponentClass);
      instance.__injector = injector;

      const mergedProps = Object.create(
        Object.getPrototypeOf(instance.props || {}),
      );

      Object.defineProperties(
        mergedProps,
        Object.getOwnPropertyDescriptors(instance.props || {}),
      );

      Object.defineProperties(
        mergedProps,
        Object.getOwnPropertyDescriptors(cleanProps || {}),
      );

      instance.props = mergedProps;

      instance.onInit?.();

      if (typeof instance.build !== "function") {
        throw new Error(`Component ${name} does not implement build()`);
      }

      const rendered = instance.build();

      container.replaceWith(rendered);
    } catch (error) {
      console.error(`Failed to load client component ${name}:`, error);

      container.textContent = `Error loading component: ${name}`;
      container.className = "client-component-error";
    }
  }
}
