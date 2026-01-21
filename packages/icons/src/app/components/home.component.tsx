import { Component } from "@kithinji/orca";

@Component()
export class Home {
  props!: {
    name: string;
  };

  constructor() {}

  build() {
    return (
      <div>
        <h2>App List</h2>
        <p>List component for app</p>
        {/* Add your list implementation here */}
      </div>
    );
  }
}
