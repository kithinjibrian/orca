"use interactive";

import { apply$, style$ } from "@kithinji/arcane";
import { Component } from "@kithinji/orca";
import { MenuItem } from "./menu-item";
import { ContentService } from "../content.service";

@Component({
  deps: [MenuItem],
})
export class AppSidebar {
  props!: {
    open: boolean;
  };

  constructor(private readonly contentService: ContentService) {
    this.contentService.getMenu();
  }

  build() {
    return (
      <aside {...apply$(cls.aside, this.props.open && cls.asideOpen)}>
        <nav>
          {this.contentService.menu.value.map((item) => (
            <MenuItem item={item} level={0} />
          ))}
        </nav>
      </aside>
    );
  }
}

const cls = style$({
  aside: {
    width: "16rem",
    padding: "1rem",
    overflowY: "auto",
    height: "100vh",
    backgroundColor: "#161616",

    position: {
      default: "static",
      "@media (max-width: 1024px)": "fixed",
    },
    top: {
      "@media (max-width: 1024px)": 0,
    },
    left: {
      "@media (max-width: 1024px)": 0,
    },
    bottom: {
      "@media (max-width: 1024px)": 0,
    },
    zIndex: {
      "@media (max-width: 1024px)": 20,
    },
    transform: {
      "@media (max-width: 1024px)": "translateX(-100%)",
    },
  },

  asideOpen: {
    transform: {
      "@media (max-width: 1024px)": "translateX(0)",
    },
  },
});
