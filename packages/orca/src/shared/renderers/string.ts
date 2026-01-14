import { JSX } from "../jsx";
import { Injector, ProviderNormalizer } from "../module";
import { COMPONENT, COMPONENT_PROVIDERS } from "../symbols";
import { Constructor, Provider } from "../types";

export class StringRenderer {
  constructor(private rootInjector: Injector) {}

  render(
    vnode: JSX.Element,
    parentInjector: Injector = this.rootInjector
  ): any {
    if (typeof vnode.type === "function") {
      const ComponentClass = vnode.type;
      const isComponent = Reflect.getMetadata(COMPONENT, ComponentClass);

      let componentInjector = parentInjector;

      if (isComponent) {
        const localProviders: (Provider | Constructor)[] =
          Reflect.getMetadata(COMPONENT_PROVIDERS, ComponentClass) || [];

        if (localProviders.length > 0) {
          componentInjector = new Injector(
            localProviders.map((p) => ProviderNormalizer.normalize(p)),
            parentInjector
          );
        }
      }

      const instance: any = componentInjector.resolve(ComponentClass);

      instance.props = vnode.props || {};

      const childVNode = instance.build();

      return this.render(childVNode, componentInjector);
    }

    if (typeof vnode.type === "string") {
      const { children, ...attrs } = vnode.props;

      const attrsStr = Object.entries(attrs)
        .map(([key, value]) => {
          if (value === true) return key;
          if (value === false || value === null || value === undefined)
            return "";
          return `${key}="${this.escapeHtml(String(value))}"`;
        })
        .filter(Boolean)
        .join(" ");

      const openTag = attrsStr
        ? `<${vnode.type} ${attrsStr}>`
        : `<${vnode.type}>`;

      const selfClosing = ["img", "br", "hr", "input", "meta", "link"];
      if (selfClosing.includes(vnode.type)) {
        return attrsStr ? `<${vnode.type} ${attrsStr} />` : `<${vnode.type} />`;
      }

      let childrenHtml = "";
      if (children !== undefined && children !== null) {
        if (Array.isArray(children)) {
          childrenHtml = children
            .map((child) => {
              if (typeof child === "string" || typeof child === "number") {
                return this.escapeHtml(String(child));
              }
              return this.render(child, parentInjector);
            })
            .join("");
        } else if (typeof children === "object" && "type" in children) {
          childrenHtml = this.render(children, parentInjector);
        } else {
          childrenHtml = this.escapeHtml(String(children));
        }
      }

      return `${openTag}${childrenHtml}</${vnode.type}>`;
    }

    return "";
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
