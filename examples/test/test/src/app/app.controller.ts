import { Controller, Post } from "@kithinji/orca";
import { AppService } from "./app.service";

@Controller("polo")
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post("lo")
  create() {
    return this.appService.create(1);
  }
}
