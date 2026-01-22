"use client";

import { Component, Signal, signal } from "@kithinji/orca";
import { apply$, style$ } from "@kithinji/arcane";
import { AppService } from "./app.service";
import { AppHeader, AppRightbar, AppSidebar, MainArea } from "./components";

@Component({
  deps: [AppHeader, AppSidebar, AppRightbar, MainArea],
})
export class AppPage {
  sidebar: Signal<boolean> = signal(false);

  constructor(public appService: AppService) {}

  build() {
    return (
      <div {...apply$(cls.container)}>
        <AppHeader openSignal={this.sidebar} />
        <div {...apply$(cls.content)}>
          <AppSidebar open={this.sidebar.value} />
          <MainArea />
          <AppRightbar />
        </div>
        <div
          {...apply$(cls.overlay, this.sidebar.value && cls.overlayActive)}
          onClick={() => {
            this.sidebar.value = false;
          }}
        >
          <></>
        </div>
      </div>
    );
  }
}

const cls = style$({
  container: {
    backgroundColor: "#161616",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    color: "white",
  },
  content: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  overlay: {
    display: "none",
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "#00000080",
    zIndex: 10,
  },
  overlayActive: {
    display: {
      default: "none",
      "@media (max-width: 1024px)": "block",
    },
  },
});
