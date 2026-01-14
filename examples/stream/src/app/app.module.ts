import { Module, RouterModule, ServeStaticModule } from "@kithinji/orca";
import { ComponentModule } from "@/component/component.module";
import { AppService } from "./app.service";
import { AppPage } from "./app.page";
import { AppList } from "./components/app-list.component";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: "./public",
    }),
    RouterModule.forRoot(),
    ComponentModule,
  ],
  providers: [AppService],
  declarations: [AppPage, AppList],
  exports: [AppService, AppPage],
  controllers: [AppController],
  bootstrap: AppPage,
})
export class AppModule {}
