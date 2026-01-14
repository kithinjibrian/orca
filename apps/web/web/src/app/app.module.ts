import { Module, RouterModule, ServeStaticModule } from "@kithinji/orca";
import { ComponentModule } from "@/component/component.module";
import { AppService } from "./app.service";
import { AppPage } from "./app.page";
import { AppHeader, AppRightbar, AppSidebar, MainArea } from "./components";
import { MenuItem } from "./components/menu-item";
import { ContentService } from "./content.service";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: "./public",
    }),
    RouterModule.forRoot(),
    ComponentModule,
  ],
  providers: [AppService, ContentService],
  exports: [AppService, AppPage],
  declarations: [
    AppPage, // app page
    AppRightbar,
    AppHeader,
    AppSidebar,
    MainArea,
    MenuItem,
  ],
  bootstrap: AppPage,
})
export class AppModule {}
