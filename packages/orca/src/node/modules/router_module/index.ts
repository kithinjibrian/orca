import { DynamicModule, JSX } from "@/shared";

export class Navigate {
  public push(component: JSX.Element) {}

  public replace(component: JSX.Element) {}

  public goBack() {}

  public goForward() {}

  public canGoBack() {}

  public canGoForward() {}

  public getCurrentPage() {}

  public clear() {}
}

export class RouterModule {
  static forRoot(): DynamicModule {
    return {
      module: RouterModule,
      providers: [Navigate],
      exports: [Navigate],
    };
  }
}
