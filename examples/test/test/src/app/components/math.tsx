"use client";

import { Component } from "@kithinji/orca";

@Component()
export class H1 {
  props!: {
    name: string;
  };

  build() {
    return <h1>Server component: {this.props.name}</h1>;
  }
}
