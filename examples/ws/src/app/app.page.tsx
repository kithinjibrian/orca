import { Component } from "@kithinji/orca";
import { AppService } from "./app.service";
import { AppList } from "./components/app-list.component";

@Component()
export class AppPage {
  constructor(public appService: AppService) {}

  build() {
    return (
      <div>
        <h1>App Management</h1>
        <AppList />
      </div>
    );
  }
}
