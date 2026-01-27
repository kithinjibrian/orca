import {
  COMPONENT,
  COMPONENT_DEPS,
  COMPONENT_PROVIDERS,
  CONTROLLERS_KEY,
  DECLARATIONS_KEY,
  DESIGN_PARAMTYPES,
  EXPORTS_KEY,
  IMPORTS_KEY,
  INJECT_TOKENS_KEY,
  PROVIDERS_KEY,
} from "../symbols";
import {
  Constructor,
  DynamicModule,
  IModule,
  InjectedToken,
  Provider,
  Token,
  OptionalFactoryDependency,
} from "../types";
import { Node } from "./node";

export class Compiler {
  private nodes: Map<string, Node> = new Map();

  public compile(rootModule: Constructor): Node {
    return this.createNode(rootModule);
  }

  private createNode(moduleOrDynamic: IModule): Node {
    const target = this.isDynamicModule(moduleOrDynamic)
      ? moduleOrDynamic.module
      : moduleOrDynamic;

    const nodeKey = this.getNodeKey(moduleOrDynamic, target);

    if (this.nodes.has(nodeKey)) return this.nodes.get(nodeKey)!;

    const node = new Node(nodeKey);
    this.nodes.set(nodeKey, node);

    const imports = this.getImports(moduleOrDynamic);

    node.setChildren(imports.map((imp) => this.createNode(imp)));

    const providers = this.getProviders(moduleOrDynamic);
    const controllers = this.getControllers(moduleOrDynamic);
    const declarations = this.getDeclarations(moduleOrDynamic);

    [...providers, ...controllers].forEach((item) => {
      const token = this.getProviderToken(item);
      const deps = this.extractDependencies(item);
      node.addToken(token, deps);
    });

    node.addProviders(providers);

    declarations.forEach((dec) => {
      node.addProviders([{ provide: dec, useClass: dec, scope: "transient" }]);
    });

    controllers.forEach((ctrl) => {
      node.addProviders([
        { provide: ctrl, useClass: ctrl, scope: "singleton" },
      ]);
    });

    [...declarations, ...controllers].forEach((comp) => {
      if (Reflect.getMetadata(COMPONENT, comp)) {
        const constructorDeps = this.getConstructorDependencies(comp);
        node.addToken(comp, constructorDeps);

        const componentDeps: Constructor[] =
          Reflect.getMetadata(COMPONENT_DEPS, comp) || [];

        const allDeps = [...constructorDeps, ...componentDeps];
        node.addToken(comp, allDeps);

        const localProviders: (Provider | Constructor)[] =
          Reflect.getMetadata(COMPONENT_PROVIDERS, comp) || [];
        node.addProviders(localProviders);

        localProviders.forEach((lp) => {
          const token = this.getProviderToken(lp);
          const deps = this.extractDependencies(lp);
          node.addToken(token, deps);
        });
      }
    });

    this.getExports(moduleOrDynamic).forEach((exp) => node.addExport(exp));

    return node;
  }

  private getNodeKey(moduleOrDynamic: IModule, target: Constructor): string {
    if (this.isDynamicModule(moduleOrDynamic)) {
      if (moduleOrDynamic.__uniqueId) {
        return `${target.name}:${moduleOrDynamic.__uniqueId}`;
      }

      const autoId = this.generateAutoId(moduleOrDynamic);
      if (autoId) {
        return `${target.name}:${autoId}`;
      }
    }
    return target.name;
  }

  private generateAutoId(dynamicModule: DynamicModule): string | null {
    const parts: string[] = [];

    if (dynamicModule.providers && dynamicModule.providers.length > 0) {
      const providerTokens = dynamicModule.providers
        .map((p) => this.getProviderToken(p))
        .map((t) => (typeof t === "function" ? t.name : String(t)))
        .sort()
        .join(",");
      parts.push(`p:${providerTokens}`);
    }

    if (dynamicModule.exports && dynamicModule.exports.length > 0) {
      const exportTokens = dynamicModule.exports
        .map((t) => (typeof t === "function" ? t.name : String(t)))
        .sort()
        .join(",");
      parts.push(`e:${exportTokens}`);
    }

    if (dynamicModule.controllers && dynamicModule.controllers.length > 0) {
      const controllerNames = dynamicModule.controllers
        .map((c) => c.name)
        .sort()
        .join(",");
      parts.push(`c:${controllerNames}`);
    }

    if (dynamicModule.declarations && dynamicModule.declarations.length > 0) {
      const declarationNames = dynamicModule.declarations
        .map((d) => d.name)
        .sort()
        .join(",");
      parts.push(`d:${declarationNames}`);
    }

    return parts.length > 0 ? parts.join("|") : null;
  }

  public validate(rootNode: Node): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allNodes = new Map<string, Node>();
    this.collectAllNodes(rootNode, allNodes);

    const tokenName = (token: Token<any>) =>
      typeof token === "function" ? token.name : String(token);

    allNodes.forEach((node) => {
      const moduleName = node.name;
      const providedTokens = node.getTokens();
      const exportedTokens = node.getExports();

      for (const exp of exportedTokens) {
        if (!providedTokens.has(exp)) {
          errors.push(
            `EXPORT ERROR in module "${moduleName}":\n` +
              `   Exports token "${tokenName(
                exp,
              )}" but this module does not provide it.\n` +
              `   → Add it to providers/controllers/declarations, or remove from exports.`,
          );
        }
      }

      const seen = new Set<Token<any>>();
      for (const token of providedTokens.keys()) {
        if (seen.has(token)) {
          errors.push(
            `DUPLICATE PROVIDER in module "${moduleName}":\n` +
              `   Token "${tokenName(token)}" is registered more than once.\n` +
              `   → Remove duplicate entries.`,
          );
        }
        seen.add(token);
      }

      for (const [token, deps] of providedTokens) {
        for (const dep of deps) {
          if (providedTokens.has(dep)) continue;

          const providingModule = this.findProvidingModule(
            dep,
            node,
            allNodes,
            new Set(),
          );
          if (!providingModule) {
            const consumer = tokenName(token);
            const missing = tokenName(dep);

            const possibleProviders = Array.from(allNodes.values())
              .filter((n) => n.getTokens().has(dep))
              .map((n) => n.name);

            let suggestion = "";
            if (possibleProviders.length > 0) {
              suggestion =
                `\n   → "${missing}" IS provided in: ${possibleProviders.join(
                  ", ",
                )}\n` +
                `   → Ensure one of those modules exports it AND "${moduleName}" imports that module.`;
            } else {
              suggestion = `\n   → "${missing}" is not provided anywhere. Add a provider for it.`;
            }

            errors.push(
              `UNRESOLVED DEPENDENCY in module "${moduleName}":\n` +
                `   "${consumer}" requires "${missing}"${suggestion}`,
            );
          }
        }
      }

      providedTokens.forEach((deps, token) => {
        if (
          typeof token === "function" &&
          Reflect.getMetadata(COMPONENT, token)
        ) {
          const componentDeps: Constructor[] =
            Reflect.getMetadata(COMPONENT_DEPS, token) || [];

          componentDeps.forEach((depComp) => {
            if (
              typeof depComp === "function" &&
              !Reflect.getMetadata(COMPONENT, depComp)
            ) {
              errors.push(
                `COMPONENT DEPENDENCY ERROR in module "${moduleName}":\n` +
                  `   Component "${tokenName(token)}" lists "${tokenName(
                    depComp,
                  )}" in deps\n` +
                  `   → "${tokenName(
                    depComp,
                  )}" is not a component (missing @Component decorator)`,
              );
            }

            if (!providedTokens.has(depComp)) {
              const providingMod = this.findProvidingModule(
                depComp,
                node,
                allNodes,
                new Set(),
              );
              if (!providingMod) {
                errors.push(
                  `COMPONENT DEPENDENCY ERROR in module "${moduleName}":\n` +
                    `   Component "${tokenName(token)}" renders "${tokenName(
                      depComp,
                    )}"\n` +
                    `   → "${tokenName(
                      depComp,
                    )}" must be in declarations or imported`,
                );
              }
            }
          });
        }
      });
    });

    return { valid: errors.length === 0, errors };
  }

  private collectAllNodes(
    node: Node,
    collected: Map<string, Node>,
    visited = new Set<string>(),
  ): void {
    if (visited.has(node.name)) return;
    visited.add(node.name);
    collected.set(node.name, node);
    node
      .getChildren()
      .forEach((child) => this.collectAllNodes(child, collected, visited));
  }

  private findProvidingModule(
    token: Token<any>,
    fromNode: Node,
    allNodes: Map<string, Node>,
    visited: Set<string> = new Set(),
  ): string | null {
    if (visited.has(fromNode.name)) return null;
    visited.add(fromNode.name);

    for (const child of fromNode.getChildren()) {
      if (child.getTokens().has(token) && child.getExports().has(token)) {
        return child.name;
      }
      const found = this.findProvidingModule(token, child, allNodes, visited);
      if (found) return found;
    }
    return null;
  }

  private getProviderToken(provider: Provider | Constructor): Token<any> {
    return typeof provider === "function" ? provider : provider.provide;
  }

  private extractDependencies(item: Provider | Constructor): Token<any>[] {
    if (typeof item === "object" && "inject" in item && item.inject) {
      return item.inject
        .filter((dep) => {
          if (this.isOptionalDependency(dep)) {
            return !dep.optional;
          }
          return true;
        })
        .map((dep) => (this.isOptionalDependency(dep) ? dep.token : dep));
    }
    if (typeof item === "object" && item.useClass)
      return this.getConstructorDependencies(item.useClass);
    if (typeof item === "function")
      return this.getConstructorDependencies(item);
    return [];
  }

  private isOptionalDependency(
    dep: Token | OptionalFactoryDependency,
  ): dep is OptionalFactoryDependency {
    return typeof dep === "object" && "token" in dep && "optional" in dep;
  }

  private getConstructorDependencies(constructor: Constructor): Token<any>[] {
    const injectTokens: Map<
      number,
      InjectedToken<any>
    > = Reflect.getOwnMetadata(INJECT_TOKENS_KEY, constructor) || new Map();

    const paramTypes =
      Reflect.getMetadata(DESIGN_PARAMTYPES, constructor) || [];

    return paramTypes
      .map((type: Token<any>, index: number) => {
        const injected = injectTokens.get(index);

        if (injected?.maybe) {
          return null;
        }

        return injected?.token ?? type;
      })
      .filter((token: any): token is Token<any> => Boolean(token));
  }

  private isDynamicModule(m: IModule): m is DynamicModule {
    return typeof m === "object" && "module" in m;
  }

  private getImports(m: IModule): IModule[] {
    if (this.isDynamicModule(m)) return m.imports || [];
    return Reflect.getMetadata(IMPORTS_KEY, m) || [];
  }

  private getProviders(m: IModule): (Provider | Constructor)[] {
    if (this.isDynamicModule(m)) return m.providers || [];
    return Reflect.getMetadata(PROVIDERS_KEY, m) || [];
  }

  private getControllers(m: IModule): Constructor[] {
    if (this.isDynamicModule(m)) return m.controllers || [];
    return Reflect.getMetadata(CONTROLLERS_KEY, m) || [];
  }

  private getDeclarations(m: IModule): Constructor[] {
    if (this.isDynamicModule(m)) return m.declarations || [];
    return Reflect.getMetadata(DECLARATIONS_KEY, m) || [];
  }

  private getExports(m: IModule): Token<any>[] {
    if (this.isDynamicModule(m)) return m.exports || [];
    return Reflect.getMetadata(EXPORTS_KEY, m) || [];
  }

  public printDAG(node: Node, indent = "", visited = new Set<string>()): void {
    if (visited.has(node.name)) {
      console.log(`${indent}${node.name} (circular)`);
      return;
    }
    visited.add(node.name);
    console.log(`${indent}${node.name}`);

    const tokens = node.getTokens();
    if (tokens.size > 0) {
      console.log(`${indent}├─ Tokens:`);
      Array.from(tokens.entries()).forEach(([token, deps], i, arr) => {
        const prefix = i === arr.length - 1 ? "└─" : "├─";
        const tokenName =
          typeof token === "function" ? token.name : String(token);
        const depStr = deps.length
          ? ` → [${deps
              .map((d) => (typeof d === "function" ? d.name : String(d)))
              .join(", ")}]`
          : "";
        console.log(`${indent}│ ${prefix} ${tokenName}${depStr}`);
      });
    }

    const exports = node.getExports();
    if (exports.size > 0) {
      const names = Array.from(exports).map((t) =>
        typeof t === "function" ? t.name : String(t),
      );
      console.log(`${indent}├─ Exports: [${names.join(", ")}]`);
    }

    const children = node.getChildren();
    if (children.length > 0) {
      console.log(`${indent}└─ Imports:`);
      children.forEach((child, i) => {
        const isLast = i === children.length - 1;
        const childIndent = indent + (isLast ? "   " : "│  ");
        this.printDAG(child, childIndent, new Set(visited));
      });
    }
  }
}
