import { Component } from "@kithinji/orca";
import { AppList } from "./components/app-list.component";

@Component({
  deps: [AppList],
})
export class AppPage {
    build() {
        return (
            <div>
                <h1>App Management</h1>
                <AppList name="hello" />
            </div>
        );
    }
}
