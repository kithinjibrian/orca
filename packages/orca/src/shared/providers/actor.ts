import { Message, MessageHandler } from "../types";

export abstract class BaseActor {
  private mailbox: Message[] = [];
  private isProcessing: boolean = false;
  private subscribers: Map<string, MessageHandler[]> = new Map();

  abstract send(to: string, message: { event: string; data: any }): void;

  public receive(message: Message) {
    this.mailbox.push(message);
    this.process();
  }

  public subscribe(tag: string, handler: MessageHandler) {
    if (!this.subscribers.has(tag)) {
      this.subscribers.set(tag, []);
    }
    this.subscribers.get(tag)!.push(handler);
  }

  public unsubscribe(tag: string, handler: MessageHandler) {
    const handlers = this.subscribers.get(tag);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private async process() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.mailbox.length > 0) {
      const message = this.mailbox.shift()!;
      const handlers = this.subscribers.get(message.event);

      if (handlers) {
        for (const handler of handlers) {
          await handler(message);
        }
      }
    }

    this.isProcessing = false;
  }
}
