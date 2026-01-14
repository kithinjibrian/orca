import { DESIGN_PARAMTYPES, INJECT_TOKENS_KEY } from "../symbols";
import { Constructor, InjectedToken, Provider, Token } from "../types";
import { Node, ProviderNormalizer } from "./node";

export class Injector {
  private instanceCache = new Map<Token<any>, any>();
  private providerMap = new Map<Token<any>, Provider>();
  private parent?: Injector;

  constructor(providers: Provider[], parent?: Injector) {
    this.parent = parent;
    providers.forEach((p) => {
      const normalized = ProviderNormalizer.normalize(p);
      this.providerMap.set(normalized.provide, normalized);
    });
  }

  addProvider(provider: Provider | Constructor) {
    const normalized = ProviderNormalizer.normalize(provider);
    this.providerMap.set(normalized.provide, normalized);
  }

  resolve<T>(token: Token<T>): T {
    if (this.instanceCache.has(token)) {
      return this.instanceCache.get(token);
    }

    const provider = this.providerMap.get(token);

    if (!provider) {
      if (this.parent) {
        return this.parent.resolve(token);
      }
      throw new Error(
        `No provider for token: ${
          typeof token === "function" ? token.name : String(token)
        }`
      );
    }

    const instance = this.createInstance(provider);

    if (provider.scope !== "transient") {
      this.instanceCache.set(token, instance);
    }

    return instance as T;
  }

  private createInstance(provider: Provider): any {
    if ("useValue" in provider && provider.useValue !== undefined)
      return provider.useValue;
    if (provider.useExisting) return this.resolve(provider.useExisting);
    if (provider.useFactory) {
      const deps = (provider.deps || []).map((d) => this.resolve(d));
      return provider.useFactory(...deps);
    }

    const Ctor = provider.useClass || (provider.provide as Constructor);
    const deps = provider.deps || this.getConstructorDeps(Ctor);

    return new Ctor(...deps.map((d) => this.resolve(d)));
  }

  private getConstructorDeps(ctor: Constructor): Token<any>[] {
    const injectTokens: Map<
      number,
      InjectedToken<any>
    > = Reflect.getOwnMetadata(INJECT_TOKENS_KEY, ctor) || new Map();

    const paramTypes = Reflect.getMetadata(DESIGN_PARAMTYPES, ctor) || [];

    return paramTypes
      .map((type: any, index: number) => {
        const injected = injectTokens.get(index);
        return injected?.token ?? type;
      })
      .filter((token: any): token is Token<any> => Boolean(token));
  }
}

export function collectAllProvidersFromNode(
  node: Node,
  collected = new Set<Provider>()
): Provider[] {
  node.getProviders().forEach((p) => collected.add(p));
  node
    .getChildren()
    .forEach((child) => collectAllProvidersFromNode(child, collected));
  return Array.from(collected);
}
