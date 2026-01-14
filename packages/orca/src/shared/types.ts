export type Constructor<T = any> = new (...args: any[]) => T;

export type Token<T> = Constructor<T> | string | symbol;

export type Scope = "singleton" | "transient";

export interface Provider<T = any> {
  provide: Token<T>;
  useClass?: Constructor<T>;
  useValue?: T;
  useFactory?: (...args: any[]) => T;
  scope?: Scope;
  useExisting?: Token<T>;
  deps?: Token<any>[];
  eager?: boolean;
}

export interface DynamicModule {
  module: Constructor;
  providers?: (Provider | Constructor)[];
  controllers?: Constructor[];
  declarations?: Constructor[];
  imports?: IModule[];
  exports?: Token<any>[];
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
  deps?: Constructor[];
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
}

export enum HttpMethod {
  GET = "get",
  POST = "post",
}

export type MethodDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<T>
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
