import { DESIGN_PARAMTYPES, INJECT_TOKENS_KEY } from "../symbols";
import {
  Constructor,
  InjectedToken,
  Provider,
  Token,
  OptionalFactoryDependency,
} from "../types";
import { Node, ProviderNormalizer } from "./node";

export class Injector {
  private instanceCache = new Map<Token<any>, any>();
  private promiseCache = new Map<Token<any>, Promise<any>>();
  private providerMap = new Map<Token<any>, Provider>();
  private parent?: Injector;

  constructor(providers: Provider[], parent?: Injector) {
    this.parent = parent;
    providers.forEach((p) => {
      const normalized = ProviderNormalizer.normalize(p);
      this.providerMap.set(normalized.provide, normalized);
    });
  }

  createChild(providers: Provider[]): Injector {
    return new Injector(providers, this);
  }

  addProvider(provider: Provider | Constructor) {
    const normalized = ProviderNormalizer.normalize(provider);
    this.providerMap.set(normalized.provide, normalized);
  }

  async resolve<T>(token: Token<T>): Promise<T> {
    if (this.instanceCache.has(token)) {
      return this.instanceCache.get(token);
    }

    if (this.promiseCache.has(token)) {
      return this.promiseCache.get(token);
    }

    const provider = this.providerMap.get(token);
    if (!provider) {
      if (this.parent) {
        return this.parent.resolve(token);
      }

      throw new Error(
        `No provider for token: ${
          typeof token === "function" ? token.name : String(token)
        }`,
      );
    }

    const instancePromise = this.createInstance(provider);
    this.promiseCache.set(token, instancePromise);

    try {
      const instance = await instancePromise;

      if (provider.scope !== "transient") {
        this.instanceCache.set(token, instance);
      }

      return instance as T;
    } finally {
      this.promiseCache.delete(token);
    }
  }

  resolveSync<T>(token: Token<T>): T {
    if (this.instanceCache.has(token)) {
      return this.instanceCache.get(token);
    }

    const provider = this.providerMap.get(token);
    if (!provider) {
      if (this.parent) {
        return this.parent.resolveSync(token);
      }

      throw new Error(
        `No provider for token: ${
          typeof token === "function" ? token.name : String(token)
        }`,
      );
    }

    const instance = this.createInstanceSync(provider);
    if (provider.scope !== "transient") {
      this.instanceCache.set(token, instance);
    }
    return instance as T;
  }

  private async createInstance(provider: Provider): Promise<any> {
    if ("useValue" in provider) return provider.useValue;

    if (provider.useExisting) return this.resolve(provider.useExisting);

    if (provider.useFactory) {
      const deps = await Promise.all(
        (provider.inject || []).map((d) => this.resolveDependency(d)),
      );
      return provider.useFactory(...deps);
    }

    const Ctor = provider.useClass || (provider.provide as Constructor);
    const deps = provider.inject || this.getConstructorDeps(Ctor);
    const resolvedDeps = await Promise.all(
      deps.map((d) => this.resolveDependency(d)),
    );
    return new Ctor(...resolvedDeps);
  }

  private createInstanceSync(provider: Provider): any {
    if ("useValue" in provider && provider.useValue !== undefined)
      return provider.useValue;

    if (provider.useExisting) return this.resolveSync(provider.useExisting);

    if (provider.useFactory) {
      const deps = (provider.inject || []).map((d) =>
        this.resolveDependencySync(d),
      );
      const result = provider.useFactory(...deps);

      if (result instanceof Promise) {
        throw new Error(
          `Async factory detected but resolveSync() was called. Use resolve() instead.`,
        );
      }

      return result;
    }

    const Ctor = provider.useClass || (provider.provide as Constructor);
    const deps = provider.inject || this.getConstructorDeps(Ctor);
    return new Ctor(...deps.map((d) => this.resolveDependencySync(d)));
  }

  private async resolveDependency(
    dep: Token<any> | OptionalFactoryDependency,
  ): Promise<any> {
    if (this.isOptionalDependency(dep)) {
      try {
        return await this.resolve(dep.token);
      } catch (error) {
        if (dep.optional) {
          return undefined;
        }
        throw error;
      }
    }
    return this.resolve(dep);
  }

  private resolveDependencySync(
    dep: Token<any> | OptionalFactoryDependency,
  ): any {
    if (this.isOptionalDependency(dep)) {
      try {
        return this.resolveSync(dep.token);
      } catch (error) {
        if (dep.optional) {
          return undefined;
        }
        throw error;
      }
    }
    return this.resolveSync(dep);
  }

  private isOptionalDependency(
    dep: Token<any> | OptionalFactoryDependency,
  ): dep is OptionalFactoryDependency {
    return (
      typeof dep === "object" &&
      dep !== null &&
      "token" in dep &&
      "optional" in dep
    );
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
  collected = new Set<Provider>(),
): Provider[] {
  node.getProviders().forEach((p) => collected.add(p));
  node
    .getChildren()
    .forEach((child) => collectAllProvidersFromNode(child, collected));
  return Array.from(collected);
}
