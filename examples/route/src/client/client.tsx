"use client";

import {
  Module,
  BrowserFactory,
  Component,
  RouterModule,
  RouterOutlet,
  HttpClientModule,
} from "@kithinji/orca";

@Component({
  inject: [RouterOutlet],
})
class AppComponent {
  build() {
    return <RouterOutlet />;
  }
}

@Module({
  imports: [RouterModule.forRoot(), HttpClientModule],
  declarations: [AppComponent],
  bootstrap: AppComponent,
})
class AppModule {}

export function bootstrap() {
  BrowserFactory.create(AppModule, document.getElementById("root")!);
}

bootstrap();

export { Navigate, getCurrentInjector } from "@kithinji/orca";
