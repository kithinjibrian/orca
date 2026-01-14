"use public";

import { Injectable, Signature } from "@kithinji/orca";
import { blogGetOutput } from "./schemas/get";
import { inlineFiles$ } from "@kithinji/arcane";

export interface Blog {
  id: number;
  content: string;
  next?: {
    id: number;
    label: string;
  };
  prev?: {
    id: number;
    label: string;
  };
}

export interface MenuItemData {
  id: number;
  label: string;
  next?: number;
  prev?: number;
  children?: MenuItemData[];
}

@Injectable()
export class AppService {
  private blogs: string[] = inlineFiles$([
    "./blogs/introduction.md",
    "./blogs/installation.md",
    "./blogs/directives.md",
    "./blogs/di.md",
    "./blogs/providers.md",
    "./blogs/controllers.md",
    "./blogs/components.md",
    "./blogs/modules.md",
    "./blogs/event.md",
    "./blogs/signals.md",
    "./blogs/observables.md",
    "./blogs/macros.md",
    "./blogs/css.md",
    "./blogs/routing.md",
  ]);

  private menus: MenuItemData[] = [
    { id: 1, label: "Introduction", next: 2 },
    { id: 2, label: "Installation", prev: 1, next: 3 },
    { id: 3, label: "Directives", prev: 2, next: 4 },
    {
      id: 4,
      label: "Dependancy Injection",
      prev: 3,
      next: 5,
      children: [
        {
          id: 5,
          label: "Providers",
          prev: 4,
          next: 6,
        },
        {
          id: 6,
          label: "Controllers",
          prev: 5,
          next: 7,
        },
        {
          id: 7,
          label: "Components",
          prev: 6,
          next: 8,
        },
        {
          id: 8,
          label: "Modules",
          prev: 7,
          next: 9,
        },
      ],
    },
    {
      id: 9,
      label: "Event System",
      prev: 8,
      next: 10,
      children: [
        {
          id: 10,
          label: "Signals",
          prev: 9,
          next: 11,
        },
        {
          id: 11,
          label: "Observables",
          prev: 10,
          next: 12,
        },
      ],
    },
    {
      id: 12,
      label: "Macros",
      prev: 11,
      next: 13,
      children: [
        {
          id: 13,
          label: "CSS",
          prev: 12,
          next: 14,
        },
      ],
    },
    {
      id: 14,
      label: "Routing",
      prev: 13,
    },
  ];

  findMenuItemById(
    items: MenuItemData[],
    id: number
  ): MenuItemData | undefined {
    for (const item of items) {
      if (item.id === id) {
        return item;
      }

      if (item.children) {
        const found = this.findMenuItemById(item.children, id);
        if (found) {
          return found;
        }
      }
    }

    return undefined;
  }

  @Signature(blogGetOutput)
  public async get(id: number): Promise<Blog> {
    const actualId = id - 1;
    const blog = this.blogs[actualId];

    if (!blog) {
      throw new Error("Blog not found");
    }

    const menu = this.findMenuItemById(this.menus, id);

    if (!menu) {
      throw new Error("Menu not found");
    }

    const getMetadata = (id?: number) => {
      let metadata = undefined;
      if (id) {
        let m = this.findMenuItemById(this.menus, id);

        if (m) {
          metadata = {
            id: m.id,
            label: m.label,
          };
        }
      }

      return metadata;
    };

    return {
      id,
      content: blog,
      next: getMetadata(menu.next),
      prev: getMetadata(menu.prev),
    };
  }

  public async getMenu() {
    return this.menus;
  }
}
