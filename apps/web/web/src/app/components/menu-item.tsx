"use client";

import { apply$, style$ } from "@kithinji/arcane";
import { Component } from "@kithinji/orca";
import { ContentService } from "../content.service";
import { MenuItemData } from "../app.service";

@Component({
  inject: [MenuItem],
})
export class MenuItem {
  props!: {
    item: MenuItemData;
    level: number;
  };

  constructor(private readonly contentService: ContentService) {}

  build() {
    const paddingLeft = `${this.props.level * 1 + 0.75}rem`;

    return (
      <div>
        <button
          {...apply$(cls.menuButton)}
          style={{ paddingLeft }}
          onClick={async () =>
            await this.contentService.get(this.props.item.id)
          }
        >
          <span {...apply$(cls.label)}>{this.props.item.label}</span>
        </button>

        {this.props.item.children && (
          <div>
            {this.props.item?.children.map((child) => (
              <MenuItem item={child} level={this.props.level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }
}

const cls = style$({
  menuButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem",
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    textAlign: "left",
    borderRadius: "0.375rem",
    transition: "background-color 0.15s",
    fontSize: "0.875rem",
    color: "#e2e8f0",
  },
  menuButtonHover: {
    backgroundColor: "#242424",
  },
  label: {
    flex: 1,
  },
});
