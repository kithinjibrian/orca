"use client";

import { Component } from "@kithinji/orca";
import { Button } from "./button.component";
import { Input } from "./input.component";

@Component()
export class Form {
  props!: {
    onSubmit?: () => void;
  };

  build() {
    return (
      <form onSubmit={this.props.onSubmit}>
        <Input />
        <Button>Submit</Button>
      </form>
    );
  }
}
