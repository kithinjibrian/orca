import { Request, Response } from "express";
import { Observable } from "rxjs";

export type Constructor<T = any> = new (...args: any[]) => T;

export type Scope = "singleton" | "transient";

export type Token<T = any> = Constructor<T> | string | symbol | Function;

export type OptionalFactoryDependency = {
  token: Token;
  optional: boolean;
};

export interface Provider<T = any> {
  provide: Token<T>;
  useClass?: Constructor<T>;
  useValue?: T;
  useFactory?: (...args: any[]) => T;
  scope?: Scope;
  useExisting?: Token<T>;
  inject?: (Token | OptionalFactoryDependency)[];
  eager?: boolean;
}

export interface DynamicModule {
  module: Constructor;
  providers?: (Provider | Constructor)[];
  controllers?: Constructor[];
  declarations?: Constructor[];
  imports?: IModule[];
  exports?: Token<any>[];
  __uniqueId?: string;
}

export type IModule = Constructor | DynamicModule;

export interface ModuleParams {
  declarations?: Constructor[];
  controllers?: Constructor[];
  providers?: (Provider | Constructor)[];
  imports?: IModule[];
  exports?: Token<any>[];
  bootstrap?: Constructor;
}

export interface ComponentParams {
  providers?: (Provider | Constructor)[];
  inject?: Constructor[];
  route?: string;
}

export interface InjectParams {
  maybe?: boolean;
}

export interface InjectedToken<T> {
  token: Token<T>;
  maybe?: boolean;
}

export enum HandlerParamType {
  ROUTE_PARAM = "ROUTE_PARAM",
  BODY = "BODY",
  QUERY = "QUERY",
  HEADERS = "HEADERS",
  REQUEST = "REQUEST",
  RESPONSE = "RESPONSE",
  FILE = "FILE",
  FILES = "FILES",
}

export enum HttpMethod {
  GET = "get",
  POST = "post",
}

export type MethodDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>,
) => void | TypedPropertyDescriptor<T>;

export interface Signal<T> {
  get value(): T;
  set value(newValue: T);
}

export type Subscriber = () => void;

export interface Observer<T> {
  next: (value: T) => void;
  error?: (err: any) => void;
  complete?: () => void;
}

export type ValidatableSchema = {
  parse: (input: any) => any;
};

export interface ControllerParams {
  providedIn?: string;
}

export interface Option {
  send: (message: Message) => void;
}

export interface Message {
  to: string;
  from: string;
  data: any;
  event: string;
}

export type MessageHandler = (data: any) => void | Promise<void>;

export interface ExecutionContext {
  getClass(): Constructor;
  getHandler(): Function;
  switchToHttp(): HttpContext;
}

export interface HttpContext {
  getRequest(): Request;
  getResponse(): Response;
  getNext?(): Function;
}

export interface CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>;
}

export interface CallHandler<T = any> {
  handle(): Promise<Observable<T>>;
}

export interface OrcaInterceptor<T = any, R = any> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<R> | Promise<Observable<R>>;
}

export interface RequestContext {
  request: Request;
  response: Response;
  metadata?: Record<string, any>;
}

export type CustomDecorator<TKey = string> = MethodDecorator &
  ClassDecorator & {
    KEY: TKey;
  };
