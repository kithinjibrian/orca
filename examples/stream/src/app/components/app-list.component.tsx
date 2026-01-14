"use interactive";

import { Component, toSignal } from "@kithinji/orca";
import { AppService } from "../app.service";

@Component()
export class AppList {
  constructor(public appService: AppService) {}

  build() {
    const a = this.appService.stream();

    let b = toSignal(a, this);

    return (
      <div>
        <p>{b.value}</p>
      </div>
    );
  }
}
