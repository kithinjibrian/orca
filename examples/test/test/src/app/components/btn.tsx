"use interactive";

import { BehaviorSubject, Component, signal } from "@kithinji/orca";

@Component()
export class Counter {
  data = new BehaviorSubject(100);

  build() {
    return <h1>data: {this.data.$value}</h1>;
  }
}
