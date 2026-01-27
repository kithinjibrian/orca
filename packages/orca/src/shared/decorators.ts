import { uid } from "uid";
import { store } from "./store";
import {
  BOOTSTRAP,
  COMPONENT,
  COMPONENT_DEPS,
  COMPONENT_PROVIDERS,
  COMPONENT_ROUTE,
  CONTROLLER,
  CONTROLLER_PREFIX_KEY,
  CONTROLLERS_KEY,
  DECLARATIONS_KEY,
  EVENT_HANDLER,
  EXPORTS_KEY,
  GUARDS_KEY,
  HTTP_METHOD_KEY,
  IMPORTS_KEY,
  INJECT_TOKENS_KEY,
  INJECTABLE,
  INTERCEPTORS_KEY,
  PARAMS_META_KEY,
  PATH_KEY,
  PROVIDERS_KEY,
  SIGNATURE_METADATA_KEY,
  SSE_ROUTE,
} from "./symbols";

import {
  CanActivate,
  ComponentParams,
  Constructor,
  ControllerParams,
  CustomDecorator,
  HandlerParamType,
  HttpMethod,
  InjectedToken,
  InjectParams,
  ModuleParams,
  OrcaInterceptor,
  Token,
  ValidatableSchema,
} from "./types";

export function Module(params: ModuleParams = {}) {
  return function (target: Constructor) {
    Reflect.defineMetadata(PROVIDERS_KEY, params.providers || [], target);
    Reflect.defineMetadata(DECLARATIONS_KEY, params.declarations || [], target);
    Reflect.defineMetadata(IMPORTS_KEY, params.imports || [], target);
    Reflect.defineMetadata(EXPORTS_KEY, params.exports || [], target);
    Reflect.defineMetadata(CONTROLLERS_KEY, params.controllers || [], target);
    Reflect.defineMetadata(BOOTSTRAP, params.bootstrap, target);
  };
}

export function Injectable() {
  return function <T extends Constructor>(target: T) {
    Reflect.defineMetadata(INJECTABLE, true, target);
    return target;
  };
}

export function mixin<T>(mixinClass: Constructor<T>) {
  Object.defineProperty(mixinClass, "name", {
    value: uid(21),
  });
  Injectable()(mixinClass);
  return mixinClass;
}

export function Component(params: ComponentParams = {}) {
  return function <T extends Constructor>(target: T) {
    store.update<Map<string, Constructor>>("components", (current) => {
      const next = current ?? new Map<string, Constructor>();
      next.set(target.name, target);

      if (params.route) {
        const [pathPattern] = params.route.split("?");
        next.set(pathPattern, target);
      }

      return next;
    });

    if (params.route) {
      Reflect.defineMetadata(COMPONENT_ROUTE, params.route, target);
    }

    Reflect.defineMetadata(COMPONENT, true, target);
    Reflect.defineMetadata(COMPONENT_PROVIDERS, params.providers || [], target);
    Reflect.defineMetadata(COMPONENT_DEPS, params.inject || [], target);
    return target;
  };
}

export function Inject(token: Token<any>, params: InjectParams = {}) {
  return function (
    target: any,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    const existingTokens: Map<
      number,
      InjectedToken<any>
    > = Reflect.getOwnMetadata(INJECT_TOKENS_KEY, target) || new Map();

    existingTokens.set(parameterIndex, {
      token: token,
      ...params,
    });

    Reflect.defineMetadata(INJECT_TOKENS_KEY, existingTokens, target);
  };
}

export function Controller(prefix?: string, options: ControllerParams = {}) {
  return function (target: Constructor) {
    Injectable()(target);

    if (options.providedIn == "root") {
      store.update<Set<Constructor>>("root_controllers", (current) => {
        const next = current ?? new Set<Constructor>();
        next.add(target);
        return next;
      });
    }

    Reflect.defineMetadata(CONTROLLER_PREFIX_KEY, prefix ?? "/", target);
    Reflect.defineMetadata(CONTROLLER, true, target);
  };
}

function getHandlerParamDecorator(type: HandlerParamType, key?: string) {
  return function (target: any, methodName: string, index: number) {
    const paramsMeta =
      Reflect.getMetadata(PARAMS_META_KEY, target, methodName) ?? {};
    paramsMeta[index] = { key, type };
    Reflect.defineMetadata(PARAMS_META_KEY, paramsMeta, target, methodName);
  };
}

export function Param(key?: string) {
  return getHandlerParamDecorator(HandlerParamType.ROUTE_PARAM, key);
}

export function Body(key?: string) {
  return getHandlerParamDecorator(HandlerParamType.BODY, key);
}

export function Query(key?: string) {
  return getHandlerParamDecorator(HandlerParamType.QUERY, key);
}

export function UploadedFile() {
  return getHandlerParamDecorator(HandlerParamType.FILE);
}

export function UploadedFiles() {
  return getHandlerParamDecorator(HandlerParamType.FILES);
}

export function Req() {
  return getHandlerParamDecorator(HandlerParamType.REQUEST);
}

export function Res() {
  return getHandlerParamDecorator(HandlerParamType.RESPONSE);
}

function getRouteDecorator(
  httpMethod: HttpMethod,
  path: string,
): MethodDecorator {
  return function (
    target: Object,
    key: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(HTTP_METHOD_KEY, httpMethod, target, key);
    Reflect.defineMetadata(PATH_KEY, path, target, key);
  };
}

export function Get(path?: string) {
  return getRouteDecorator(HttpMethod.GET, path ?? "");
}

export function Post(path?: string) {
  return getRouteDecorator(HttpMethod.POST, path ?? "");
}

export function Sse(path?: string) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(SSE_ROUTE, true, target, propertyKey);
    Reflect.defineMetadata(PATH_KEY, path, target, propertyKey);
    Reflect.defineMetadata(
      HTTP_METHOD_KEY,
      HttpMethod.GET,
      target,
      propertyKey,
    );
  };
}

export function Shared() {
  return function (
    target: any,
    _propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {};
}

export function Subscribe(pattern: string) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(EVENT_HANDLER, pattern, target, propertyKey);
  };
}

export function Signature(...schemas: ValidatableSchema[]) {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    Reflect.defineMetadata(
      SIGNATURE_METADATA_KEY,
      schemas,
      target,
      propertyKey,
    );

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

export function getSignatureMetadata(
  target: any,
  propertyKey: string | symbol,
): any[] | undefined {
  return Reflect.getMetadata(SIGNATURE_METADATA_KEY, target, propertyKey);
}

export function hasSignature(
  target: any,
  propertyKey: string | symbol,
): boolean {
  return Reflect.hasMetadata(SIGNATURE_METADATA_KEY, target, propertyKey);
}

export function parseSignatureSchemas(
  schemas: any[],
  paramCount: number,
): {
  paramSchemas: any[];
  returnSchema?: any;
} {
  if (schemas.length === 0) {
    return { paramSchemas: [] };
  }

  if (schemas.length === 1) {
    return {
      paramSchemas: [],
      returnSchema: schemas[0],
    };
  }

  const paramSchemas = schemas.slice(0, -1);
  const returnSchema = schemas[schemas.length - 1];

  if (paramSchemas.length !== paramCount) {
    throw new Error(
      `@Signature decorator has ${paramSchemas.length} parameter schemas but method has ${paramCount} parameters. They must match.`,
    );
  }

  return { paramSchemas, returnSchema };
}

export function UseInterceptors(
  ...interceptors: (Constructor<OrcaInterceptor> | OrcaInterceptor)[]
) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey && descriptor) {
      const existing =
        Reflect.getMetadata(INTERCEPTORS_KEY, target, propertyKey) || [];
      Reflect.defineMetadata(
        INTERCEPTORS_KEY,
        [...existing, ...interceptors],
        target,
        propertyKey,
      );
    } else {
      const existing = Reflect.getMetadata(INTERCEPTORS_KEY, target) || [];
      Reflect.defineMetadata(
        INTERCEPTORS_KEY,
        [...existing, ...interceptors],
        target,
      );
    }
  };
}

export function getInterceptors(
  target: any,
  propertyKey: string | symbol,
): Constructor<OrcaInterceptor>[] {
  const classInterceptors =
    Reflect.getMetadata(INTERCEPTORS_KEY, target.constructor) || [];
  const methodInterceptors =
    Reflect.getMetadata(INTERCEPTORS_KEY, target, propertyKey) || [];

  return [...classInterceptors, ...methodInterceptors];
}

export function UseGuards(
  ...guards: (Constructor<CanActivate> | CanActivate)[]
) {
  return function (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) {
    if (propertyKey && descriptor) {
      const existing =
        Reflect.getMetadata(GUARDS_KEY, target, propertyKey) || [];
      Reflect.defineMetadata(
        GUARDS_KEY,
        [...existing, ...guards],
        target,
        propertyKey,
      );
    } else {
      const existing = Reflect.getMetadata(GUARDS_KEY, target) || [];
      Reflect.defineMetadata(GUARDS_KEY, [...existing, ...guards], target);
    }
  };
}

export function getGuards(
  target: any,
  propertyKey: string | symbol,
): (Constructor<CanActivate> | CanActivate)[] {
  const classGuards = Reflect.getMetadata(GUARDS_KEY, target.constructor) || [];
  const methodGuards =
    Reflect.getMetadata(GUARDS_KEY, target, propertyKey) || [];

  return [...classGuards, ...methodGuards];
}

export const SetMetadata = <K = string, V = any>(
  metadataKey: K,
  metadataValue: V,
): CustomDecorator<K> => {
  const decoratorFactory = (target: object, key?: any, descriptor?: any) => {
    if (descriptor) {
      Reflect.defineMetadata(metadataKey, metadataValue, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(metadataKey, metadataValue, target);
    return target;
  };
  decoratorFactory.KEY = metadataKey;
  return decoratorFactory;
};

export function applyDecorators(
  ...decorators: Array<ClassDecorator | MethodDecorator | PropertyDecorator>
) {
  return <TFunction extends Function, Y>(
    target: TFunction | object,
    propertyKey?: string | symbol,
    descriptor?: TypedPropertyDescriptor<Y>,
  ) => {
    for (const decorator of decorators) {
      if (target instanceof Function && !descriptor) {
        (decorator as ClassDecorator)(target);
        continue;
      }
      (decorator as MethodDecorator | PropertyDecorator)(
        target,
        propertyKey!,
        descriptor!,
      );
    }
  };
}
