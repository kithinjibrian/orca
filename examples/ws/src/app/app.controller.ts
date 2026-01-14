import {
  ActorService,
  Controller,
  type Message,
  Subscribe,
} from "@kithinji/orca";

@Controller()
export class AppController {
  constructor(private readonly actorService: ActorService) {}

  @Subscribe("show")
  recv(msg: Message) {
    console.log("recv...", msg);

    this.actorService.send(msg.from, {
      event: "hello",
      data: "greetings",
    });
  }
}
