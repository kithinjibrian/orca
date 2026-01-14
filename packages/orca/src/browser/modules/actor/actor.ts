import { BaseActor, DynamicModule, Injectable } from "@/shared";
import { io, Socket } from "socket.io-client";

@Injectable()
export class Actor extends BaseActor {
  private pending: any[] = [];
  private socket: Socket = io();

  constructor() {
    super();

    this.socket.on("connect", () => {
      this.flushPending();
    });

    this.socket.on("message", (message) => {
      this.receive(message);
    });
  }

  public send(to: string, message: { event: string; data: any }) {
    const payload = {
      to,
      from: this.socket.id,
      ...message,
    };

    if (this.socket.connected && this.socket.id) {
      this.socket.emit("message", payload);
    } else {
      this.pending.push(payload);
    }
  }

  private flushPending() {
    if (!this.socket.id) return;

    for (const msg of this.pending) {
      msg.from = this.socket.id;
      this.socket.emit("message", msg);
    }

    this.pending = [];
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
