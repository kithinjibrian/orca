"use interactive";

import { apply$, style$ } from "@kithinji/arcane";
import { Component } from "@kithinji/orca";

@Component()
export class AppRightbar {
  build() {
    return (
      <aside {...apply$(cls.aside)}>
        <div {...apply$(cls.card)}>
          <h3 {...apply$(cls.title)}>Orca</h3>
          <blockquote {...apply$(cls.quote)}>
            Orca is a full-stack framework that lets you write client and server
            code in one shared place. It handles communication automatically,
            reduces boilerplate, and keeps logic in sync - so you can focus on
            building features instead of wiring APIs.
          </blockquote>
        </div>
      </aside>
    );
  }
}

const cls = style$({
  aside: {
    width: "16rem",
    padding: "1rem",
    overflowY: "auto",
    display: {
      default: "block",
      "@media (max-width: 1024px)": "none",
    },
  },

  card: {
    backgroundColor: "#242424",
    borderRadius: "12px",
    padding: "1.25rem",
    color: "#eaeaea",
    lineHeight: "1.6",
  },

  title: {
    marginBottom: "0.5rem",
    fontSize: "1.1rem",
    fontWeight: "600",
  },

  quote: {
    marginTop: "1rem",
    paddingLeft: "0.75rem",
    borderLeft: "3px solid #ff5722",
    fontSize: "1rem",
    color: "#eaeaea",
  },
});
