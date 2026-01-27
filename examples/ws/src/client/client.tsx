"use client";

import {
  Module,
  BrowserFactory,
  Component,
  RouterModule,
  RouterOutlet,
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
  imports: [
    RouterModule.forRoot(), //
  ],
  declarations: [AppComponent],
  bootstrap: AppComponent,
})
class AppModule {}

export function bootstrap() {
  BrowserFactory.create(AppModule, document.getElementById("root")!);
}

bootstrap();
