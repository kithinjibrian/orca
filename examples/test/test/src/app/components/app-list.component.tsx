"use interactive";

import { Component, signal } from "@kithinji/orca";
import { AppService } from "../app.service";
import { Counter } from "./btn";

@Component({
  deps: [Counter],
})
export class AppList {
  props!: {
    name: string;
  };

  constructor(public readonly appService: AppService) {}

  build() {
    return (
      <div>
        <h2>App List</h2>
        <p>List component for app</p>
        <button
          onClick={() => {
            this.appService.create({
              name: "orca",
              description: "desc",
            });
          }}
        >
          click me
        </button>
        <Counter />
        {/* Add your list implementation here */}
      </div>
    );
  }
}
