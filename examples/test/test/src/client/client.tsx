"use interactive";

import {
  Module,
  BrowserFactory,
  Component,
  RouterModule,
  RouterOutlet,
  HttpClientModule,
} from "@kithinji/orca";

@Component({
  deps: [RouterOutlet],
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

/* Don't modify */
export { Navigate, getCurrentInjector } from "@kithinji/orca";
