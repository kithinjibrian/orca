import { Injectable, Signal, signal } from "@kithinji/orca";
import { AppService, Blog, MenuItemData } from "./app.service";

@Injectable()
export class ContentService {
  /* caching fetch calls*/
  private blogs: Map<number, Blog> = new Map();
  public current: Signal<Blog> = signal({
    id: -1,
    content: "",
  });

  public menu: Signal<MenuItemData[]> = signal([]);

  constructor(private readonly appService: AppService) {}

  async get(id: number) {
    this.current.value = {
      id: -1,
      content: "",
    };

    if (this.blogs.has(id)) {
      this.current.value = this.blogs.get(id)!;
      return;
    }

    try {
      let blog = await this.appService.get(id);

      this.blogs.set(id, blog);

      this.current.value = blog;
    } catch (e: any) {
      this.current.value = e.message;
    }
  }

  async getMenu() {
    this.menu.value = await this.appService.getMenu();
  }
}
