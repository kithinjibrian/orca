import { Constructor, Provider, Token } from "../types";

export class ProviderNormalizer {
  static normalize(provider: Provider | Constructor): Provider {
    if (typeof provider === "function") {
      return { provide: provider, useClass: provider, scope: "singleton" };
    }
    return { scope: "singleton", ...provider };
  }
}

export class Node {
  private children: Node[] = [];
  private tokens = new Map<Token<any>, Token<any>[]>();
  private exports: Set<Token<any>> = new Set();
  private providers = new Map<Token<any>, Provider>();

  constructor(public name: string) {}

  traverse(cb: (node: Node) => void) {
    cb(this);
    this.children.forEach((child) => child.traverse(cb));
  }

  addProviders(providers: (Provider | Constructor)[]) {
    providers.forEach((p) => {
      const normalized = ProviderNormalizer.normalize(p);
      this.providers.set(normalized.provide, normalized);
    });
  }

  getProviders(): Map<Token<any>, Provider> {
    return this.providers;
  }

  setChildren(children: Node[]) {
    this.children = children;
  }

  addToken(token: Token<any>, dependencies: Token<any>[]) {
    this.tokens.set(token, dependencies);
  }

  addExport(token: Token<any>) {
    this.exports.add(token);
  }

  getTokens(): Map<Token<any>, Token<any>[]> {
    return this.tokens;
  }

  getExports(): Set<Token<any>> {
    return this.exports;
  }

  getChildren(): Node[] {
    return this.children;
  }
}
