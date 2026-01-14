"use client";

import { Component, Navigate } from "@kithinji/orca";
import { LoginPage } from "../login.page";

@Component({
  deps: [LoginPage],
})
export class AppList {
  constructor(private readonly navigate: Navigate) {}

  build() {
    return (
      <div>
        <h2>App List</h2>
        <p>List component for app</p>
        <button
          onClick={() => {
            this.navigate.push(<LoginPage id="90" loc="hello" />);
          }}
        >
          go to login
        </button>

        <a href="/user/login/90?loc=boom">click me</a>
      </div>
    );
  }
}
