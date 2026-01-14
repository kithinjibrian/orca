import { Module, RouterModule, ServeStaticModule } from "@kithinji/orca";
import { ComponentModule } from "@/component/component.module";
import { AppService } from "./app.service";
import { AppPage } from "./app.page";
import { AppList } from "./components/app-list.component";
import { AppController } from "./app.controller";
import { Counter } from "./components/btn";

@Module({
    imports: [
      ServeStaticModule.forRoot({
        rootPath: "./public",
      }),
      RouterModule.forRoot(),
      ComponentModule
    ],
    controllers: [AppController],
    providers: [AppService],
    declarations: [AppPage, AppList, Counter],
    exports: [AppService, AppPage],
    bootstrap: AppPage
})
export class AppModule {}
