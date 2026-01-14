import { BaseActor, DynamicModule, Injectable, Option } from "@/shared";

@Injectable()
export class Actor extends BaseActor {
  private actors: Map<string, Option> = new Map();

  public register(name: string, option: Option) {
    this.actors.set(name, option);
  }

  public send(to: string, message: { event: string; data: any }) {
    const actor = this.actors.get(to);
    if (actor) {
      actor.send({
        to,
        ...message,
        from: "server",
      });
    }
  }
}

export class ActorModule {
  static forRoot(): DynamicModule {
    return {
      module: ActorModule,
      providers: [
        {
          provide: Actor,
          useClass: Actor,
          eager: true,
        },
      ],
      exports: [Actor],
    };
  }
}
