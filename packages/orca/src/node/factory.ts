import express, { Express, Request, Response } from "express";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { Server } from "socket.io";

import {
  Constructor,
  Compiler,
  CONTROLLER_PREFIX_KEY,
  HTTP_METHOD_KEY,
  PATH_KEY,
  HandlerParamType,
  PARAMS_META_KEY,
  DESIGN_PARAMTYPES,
  EXPRESS_ADAPTER_HOST,
  Injector,
  collectAllProvidersFromNode,
  CONTROLLER,
  BOOTSTRAP,
  jsx,
  BOOTSTRAP_VNODE,
  StreamRenderer,
  symbolValueReplacer,
  setCurrentInjector,
  ProviderNormalizer,
  store,
  SSE_ROUTE,
  Observable,
  EVENT_HANDLER,
  COMPONENT_ROUTE,
  ORCA_ELEMENT_TYPE,
} from "@/shared";
import { Actor } from "./modules";

interface RouteMatch {
  component: Constructor;
  props: Record<string, any>;
}

interface ParamMeta {
  type: HandlerParamType;
  key?: string;
}

function createErrorElement(message: string) {
  return {
    $$typeof: ORCA_ELEMENT_TYPE,
    id: uuidv4(),
    type: "div",
    props: {
      style:
        "color: red; padding: 20px; border: 2px solid red; border-radius: 4px; margin: 20px;",
      children: [
        {
          $$typeof: ORCA_ELEMENT_TYPE,
          id: uuidv4(),
          type: "h2",
          props: { children: "Error" },
          key: null,
        },
        {
          $$typeof: ORCA_ELEMENT_TYPE,
          id: uuidv4(),
          type: "p",
          props: { children: message },
          key: null,
        },
      ],
    },
    key: null,
  };
}

class RouteMatcherService {
  private static parseUrl(url: string): [string, URLSearchParams] {
    const [urlPath, urlQuery] = url.split("?");
    return [urlPath, new URLSearchParams(urlQuery || "")];
  }

  private static matchPathSegments(
    patternSegments: string[],
    urlSegments: string[]
  ): Record<string, string> | null {
    if (patternSegments.length !== urlSegments.length) return null;

    const props: Record<string, string> = {};

    for (let i = 0; i < patternSegments.length; i++) {
      const segment = patternSegments[i];

      if (segment.startsWith(":")) {
        const paramName = segment.slice(1);
        props[paramName] = decodeURIComponent(urlSegments[i]);
      } else if (segment !== urlSegments[i]) {
        return null;
      }
    }

    return props;
  }

  private static extractQueryParams(
    queryPattern: string,
    urlParams: URLSearchParams,
    routePattern: string
  ): Record<string, string> {
    const props: Record<string, string> = {};
    const queryParams = queryPattern.split("&").filter(Boolean);

    for (const param of queryParams) {
      const isOptional = param.endsWith("*");
      const paramName = isOptional ? param.slice(0, -1) : param;
      const paramValue = urlParams.get(paramName);

      if (paramValue === null) {
        if (!isOptional) {
          throw new Error(
            `Missing required query parameter "${paramName}" for route "${routePattern}"`
          );
        }
        continue;
      }

      props[paramName] = decodeURIComponent(paramValue);
    }

    return props;
  }

  public static match(url: string): RouteMatch | null {
    const components = store.get<Map<string, Constructor>>("components");
    if (!components) return null;

    const [urlPath, urlParams] = this.parseUrl(url);
    const urlSegments = urlPath.split("/").filter(Boolean);

    for (const [, component] of components.entries()) {
      const routePattern = Reflect.getMetadata(COMPONENT_ROUTE, component);
      if (!routePattern) continue;

      const [pathPattern, queryPattern] = routePattern.split("?");
      const patternSegments = pathPattern.split("/").filter(Boolean);

      const pathProps = this.matchPathSegments(patternSegments, urlSegments);
      if (pathProps === null) continue;

      const queryProps = queryPattern
        ? this.extractQueryParams(queryPattern, urlParams, routePattern)
        : {};

      return {
        component,
        props: { ...pathProps, ...queryProps },
      };
    }

    return null;
  }
}

class ControllerRegistrationService {
  constructor(
    private readonly injector: Injector,
    private readonly app: Express
  ) {}

  private registerEventHandlers(
    CtrlCls: Constructor,
    instance: any,
    actor: Actor
  ): void {
    const eventHandlers = Reflect.ownKeys(CtrlCls.prototype).filter((key) =>
      Reflect.hasOwnMetadata(EVENT_HANDLER, CtrlCls.prototype, key)
    );

    for (const methodKey of eventHandlers) {
      const eventName = Reflect.getMetadata(
        EVENT_HANDLER,
        CtrlCls.prototype,
        methodKey
      ) as string;

      const handler = instance[methodKey];
      actor.subscribe(eventName, (data) => handler.call(instance, data));
    }
  }

  private buildMethodArgs(
    req: Request,
    paramsMeta: Record<number, ParamMeta>,
    designParams: any[]
  ): any[] {
    const args = Array(designParams.length).fill(undefined);

    for (let i = 0; i < designParams.length; i++) {
      const meta = paramsMeta[i];
      if (!meta) continue;

      const source = this.getParamSource(req, meta.type);
      args[i] = meta.key ? source?.[meta.key] : source;
    }

    return args;
  }

  private getParamSource(req: Request, type: HandlerParamType): any {
    switch (type) {
      case HandlerParamType.BODY:
        return req.body;
      case HandlerParamType.ROUTE_PARAM:
        return req.params;
      case HandlerParamType.QUERY:
        return req.query;
      default:
        return undefined;
    }
  }

  private async handleMethodResult(
    result: any,
    res: Response,
    isSSE: boolean
  ): Promise<void> {
    if (res.headersSent) return;

    if (isSSE && result instanceof Observable) {
      result.subscribe({
        next: (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        },
        error: (err: any) => {
          console.error("SSE error:", err);
          res.end();
        },
        complete: () => {
          res.end();
        },
      });
    } else if (result !== undefined) {
      res.json(result);
    } else {
      res.end();
    }
  }

  private registerHttpMethods(
    CtrlCls: Constructor,
    instance: any,
    prefix: string
  ): void {
    const methods = Reflect.ownKeys(CtrlCls.prototype).filter((key) =>
      Reflect.hasOwnMetadata(HTTP_METHOD_KEY, CtrlCls.prototype, key)
    );

    for (const methodKey of methods) {
      this.registerHttpMethod(CtrlCls, instance, methodKey, prefix);
    }
  }

  private registerHttpMethod(
    CtrlCls: Constructor,
    instance: any,
    methodKey: string | symbol,
    prefix: string
  ): void {
    const httpMethod = Reflect.getMetadata(
      HTTP_METHOD_KEY,
      CtrlCls.prototype,
      methodKey
    ) as "get" | "post" | "put" | "delete" | "patch";

    const routePath: string =
      Reflect.getMetadata(PATH_KEY, CtrlCls.prototype, methodKey) ?? "";

    const fullPath = this.buildFullPath(prefix, routePath);
    const isSSE = Reflect.getMetadata(
      SSE_ROUTE,
      CtrlCls.prototype,
      methodKey
    ) as boolean;
    const paramsMeta: Record<number, ParamMeta> =
      Reflect.getMetadata(PARAMS_META_KEY, CtrlCls.prototype, methodKey) ?? {};

    this.app[httpMethod](fullPath, async (req, res) => {
      try {
        if (isSSE) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
        }

        const designParams: any[] =
          Reflect.getMetadata(
            DESIGN_PARAMTYPES,
            CtrlCls.prototype,
            methodKey
          ) ?? [];

        const args = this.buildMethodArgs(req, paramsMeta, designParams);
        const result = await instance[methodKey](...args);

        await this.handleMethodResult(result, res, isSSE);
      } catch (err: any) {
        res.send(err.message);
      }
    });
  }

  private buildFullPath(prefix: string, routePath: string): string {
    const normalizedPrefix =
      prefix === "/" ? "" : `/${prefix.replace(/^\/+|\/+$/g, "")}`;

    return (
      `${normalizedPrefix}/${routePath}`
        .replace(/\/+/g, "/")
        .replace(/\/$/, "") || "/"
    );
  }

  public register(CtrlCls: Constructor): void {
    const instance = this.injector.resolve(CtrlCls);
    const prefix: string =
      Reflect.getMetadata(CONTROLLER_PREFIX_KEY, CtrlCls) ?? "/";
    const actor = this.injector.resolve(Actor);

    this.registerEventHandlers(CtrlCls, instance, actor);
    this.registerHttpMethods(CtrlCls, instance, prefix);
  }
}

class ComponentResolver {
  constructor(private readonly rootModule: Constructor) {}

  public resolve(
    componentName: string | undefined,
    body: any
  ): {
    component: Constructor | null;
    props: Record<string, any>;
    error: any;
  } {
    if (componentName === undefined || componentName === "/") {
      const bootstrap = Reflect.getMetadata(BOOTSTRAP, this.rootModule);

      if (!bootstrap) {
        return {
          component: null,
          props: {},
          error: createErrorElement("Bootstrap component not provided!"),
        };
      }

      return {
        component: bootstrap,
        props: body,
        error: null,
      };
    }

    if (typeof componentName !== "string") {
      return {
        component: null,
        props: {},
        error: createErrorElement("Component name should be a string"),
      };
    }

    if (componentName.startsWith("/")) {
      const result = RouteMatcherService.match(componentName);

      if (!result) {
        return {
          component: null,
          props: {},
          error: createErrorElement(
            `No component found for route '${componentName}'`
          ),
        };
      }

      return {
        component: result.component,
        props: result.props,
        error: null,
      };
    }

    const component = store
      .get<Map<string, Constructor>>("components")
      ?.get(componentName);

    if (!component) {
      return {
        component: null,
        props: {},
        error: createErrorElement(`Component '${componentName}' not provided!`),
      };
    }

    return {
      component,
      props: body,
      error: null,
    };
  }
}

class OscRouteHandler {
  constructor(
    private readonly injector: Injector,
    private readonly componentResolver: ComponentResolver
  ) {}

  private async streamComponent(
    renderer: StreamRenderer,
    component: Constructor,
    props: Record<string, any>,
    res: Response
  ): Promise<void> {
    const stream = renderer.render(jsx(component, props));
    for await (const chunk of stream) {
      res.write(JSON.stringify(chunk, symbolValueReplacer) + "\n");
    }
  }

  private async streamError(
    renderer: StreamRenderer,
    errorElement: any,
    res: Response
  ): Promise<void> {
    try {
      const stream = renderer.render(errorElement);
      for await (const chunk of stream) {
        res.write(JSON.stringify(chunk, symbolValueReplacer) + "\n");
      }
    } catch (innerErr) {
      console.error("Failed to stream error:", innerErr);
      res.write(
        JSON.stringify(
          {
            $$typeof: ORCA_ELEMENT_TYPE,
            id: uuidv4(),
            type: "div",
            props: { children: "Critical error occurred" },
            key: null,
          },
          symbolValueReplacer
        ) + "\n"
      );
    }
  }

  public async handle(req: Request, res: Response): Promise<void> {
    const renderer = new StreamRenderer(this.injector);
    const componentName = req.query.c as string | undefined;

    try {
      const { component, props, error } = this.componentResolver.resolve(
        componentName,
        req.body
      );

      if (error) {
        await this.streamError(renderer, error, res);
        res.end();
        return;
      }

      await this.streamComponent(renderer, component!, props, res);
    } catch (err) {
      console.error("Streaming error:", err);
      const errorElement = createErrorElement(
        err instanceof Error ? err.message : "Unknown error occurred"
      );
      await this.streamError(renderer, errorElement, res);
    }

    res.end();
  }
}

class SocketService {
  public static setup(server: http.Server, injector: Injector): void {
    const io = new Server(server);

    io.on("connection", (socket) => {
      const actor = injector.resolve(Actor);

      actor.register(socket.id, {
        send: (message) => {
          io.to(socket.id).emit("message", message);
        },
      });

      socket.on("message", (msg) => {
        const { to } = msg;
        if (to === "server") {
          actor.receive(msg);
        } else {
          actor.send(to, msg);
        }
      });
    });
  }
}

export class NodeFactory {
  private static compileAndValidate(rootModule: Constructor): any {
    const compiler = new Compiler();
    const appNode = compiler.compile(rootModule);
    const validation = compiler.validate(appNode);

    if (!validation.valid) {
      console.error("Validation failed:\n" + validation.errors.join("\n\n"));
      process.exit(1);
    }

    return appNode;
  }

  private static createRootInjector(
    appNode: any,
    app: Express,
    rootModule: Constructor
  ): Injector {
    const allProviders = collectAllProvidersFromNode(appNode);
    const rootControllers = [
      ...store.get<Set<Constructor>>("root_controllers")!,
    ].map((p) => ProviderNormalizer.normalize(p));

    const bootstrap = Reflect.getMetadata(BOOTSTRAP, rootModule);

    return new Injector([
      ...allProviders,
      ...rootControllers,
      { provide: "OSC_URL", useValue: "/osc" },
      { provide: EXPRESS_ADAPTER_HOST, useValue: app },
      {
        provide: BOOTSTRAP_VNODE,
        useValue: bootstrap ? jsx(bootstrap, {}) : undefined,
      },
      { provide: Actor, useClass: Actor, eager: true },
    ]);
  }

  private static registerControllers(
    appNode: any,
    injector: Injector,
    app: Express
  ): void {
    const registrationService = new ControllerRegistrationService(
      injector,
      app
    );
    const rootControllers = [
      ...store.get<Set<Constructor>>("root_controllers")!,
    ];

    rootControllers.forEach((ctrl) => registrationService.register(ctrl));

    appNode.traverse((node: any) => {
      const providers = [...node.getProviders().values()];

      const controllers = providers.filter((provider) =>
        Reflect.getMetadata(CONTROLLER, provider.provide)
      );

      controllers.forEach((c) => registrationService.register(c.useClass!));

      providers
        .filter((provider) => provider.eager)
        .forEach((p) => injector.resolve(p.provide));
    });
  }

  private static setupOscRoute(
    app: Express,
    injector: Injector,
    rootModule: Constructor
  ): void {
    const componentResolver = new ComponentResolver(rootModule);
    const oscHandler = new OscRouteHandler(injector, componentResolver);

    app.post("/osc", (req, res) => oscHandler.handle(req, res));
  }

  public static async create(rootModule: Constructor): Promise<http.Server> {
    const app = express();
    app.use(express.json());

    const server = http.createServer(app);

    const appNode = this.compileAndValidate(rootModule);

    const rootInjector = this.createRootInjector(appNode, app, rootModule);
    setCurrentInjector(rootInjector);

    this.registerControllers(appNode, rootInjector, app);

    this.setupOscRoute(app, rootInjector, rootModule);

    SocketService.setup(server, rootInjector);

    return server;
  }
}
