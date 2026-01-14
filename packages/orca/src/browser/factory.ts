import {
  BOOTSTRAP,
  collectAllProvidersFromNode,
  Compiler,
  Constructor,
  HttpClient,
  Injector,
  setCurrentInjector,
} from "@/shared";
import { Actor } from "./modules";

interface BootstrapInstance {
  __injector: Injector;
  build(): HTMLElement;
}

class CompilationService {
  private readonly compiler: Compiler;

  constructor() {
    this.compiler = new Compiler();
  }

  public compileAndValidate(rootModule: Constructor): any {
    const appNode = this.compiler.compile(rootModule);
    const validation = this.compiler.validate(appNode);

    if (!validation.valid) {
      throw new Error("Validation failed:\n" + validation.errors.join("\n\n"));
    }

    return appNode;
  }
}

class InjectorConfigurationService {
  public static createRootInjector(appNode: any): Injector {
    const allProviders = collectAllProvidersFromNode(appNode);

    return new Injector([
      ...allProviders,
      {
        provide: "OSC_URL",
        useValue: "/osc",
      },
      {
        provide: Actor,
        useClass: Actor,
        eager: true,
      },
      {
        provide: HttpClient,
        useClass: HttpClient,
      },
    ]);
  }

  public static instantiateEagerProviders(
    appNode: any,
    injector: Injector
  ): void {
    appNode.traverse((node: any) => {
      const providers = [...node.getProviders().values()];

      providers
        .filter((provider) => provider.eager)
        .forEach((p) => injector.resolve(p.provide));
    });
  }
}

class BootstrapService {
  public static getBootstrapComponent(rootModule: Constructor): Constructor {
    const bootstrap = Reflect.getMetadata(BOOTSTRAP, rootModule);

    if (!bootstrap) {
      throw new Error(
        `No bootstrap component found. Ensure the root module has a @Bootstrap() decorator.`
      );
    }

    return bootstrap;
  }

  public static renderBootstrap(
    bootstrap: Constructor,
    injector: Injector,
    rootElement: HTMLElement
  ): void {
    const instance = injector.resolve<BootstrapInstance>(bootstrap);

    instance.__injector = injector;

    const childDom = instance.build();
    rootElement.appendChild(childDom);
  }
}

export class BrowserFactory {
  /**
   * Creates and bootstraps the application in the browser
   *
   * @param rootModule - The root module of the application
   * @param rootElement - The DOM element to mount the application to
   * @throws {Error} If validation fails or bootstrap component is not found
   */
  public static create(
    rootModule: Constructor,
    rootElement: HTMLElement
  ): void {
    const compilationService = new CompilationService();
    const appNode = compilationService.compileAndValidate(rootModule);

    const rootInjector =
      InjectorConfigurationService.createRootInjector(appNode);
    setCurrentInjector(rootInjector);

    InjectorConfigurationService.instantiateEagerProviders(
      appNode,
      rootInjector
    );

    const bootstrap = BootstrapService.getBootstrapComponent(rootModule);
    BootstrapService.renderBootstrap(bootstrap, rootInjector, rootElement);
  }
}
