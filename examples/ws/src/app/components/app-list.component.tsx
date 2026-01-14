"use client";

import { Component } from "@kithinji/orca";
import { AppService } from "../app.service";

@Component()
export class AppList {
  constructor(public appService: AppService) {}

  build() {
    const subject = this.appService.subject();

    subject.subscribe((value) => {
      console.log(value);
    });

    return (
      <div>
        <h2>App List</h2>
        <button onClick={() => {}}>List component for app</button>
        {/* Add your list implementation here */}
      </div>
    );
  }
}
