"use client";

import { apply$, style$ } from "@kithinji/arcane";
import { Component, Signal } from "@kithinji/orca";

@Component()
export class AppHeader {
  props!: {
    openSignal: Signal<boolean>;
  };

  build() {
    return (
      <header {...apply$(cls.header)}>
        <div {...apply$(cls.div)}>
          <button
            {...apply$(cls.button)}
            onClick={() => {
              this.props.openSignal.value = !this.props.openSignal.value;
            }}
          >
            ☰
          </button>
          <h2>@kithinji/orca</h2>
        </div>
      </header>
    );
  }
}

const cls = style$({
  header: {
    padding: "0.5rem 1rem",
    color: "#ff5722",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  div: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "15px",
  },
  button: {
    border: "none",
    cursor: "pointer",
    fontSize: "1.5rem",
    color: "white",
    padding: "4px",
    background: "none",
    borderRadius: "4px",
    display: {
      default: "none",
      "@media (max-width: 1024px)": "block",
    },
  },
});
