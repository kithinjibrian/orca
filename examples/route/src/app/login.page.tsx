import { Component } from "@kithinji/orca";

@Component({
  route: "/user/login/:id?loc",
})
export class LoginPage {
  props!: {
    loc: string;
    id: string;
  };
  build() {
    return (
      <div>
        <h1>Login Page</h1>
        <a href="/">click me</a>
      </div>
    );
  }
}
