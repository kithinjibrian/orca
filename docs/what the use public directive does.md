# What the Heck Does `use public` Actually Do?

Let's talk about one of the most annoying parts of building web apps: the constant back-and-forth between client and server code.

You know the drill. You write a service on your backend, then you have to write a fetch call on the frontend, then you write types for both sides, then you realize you changed the API and now everything breaks. It's tedious, error-prone, and frankly, it gets old fast.

Orca takes a different approach. What if you could just call your server functions like they were local? No fetch calls, no manual HTTP plumbing, just regular function calls that happen to run on the server.

That's exactly what `use public` enables.

## How It Works

Here's a simple service:

```ts
"use public";

@Injectable()
export class AppService {
  @Signature(userIn, userOut)
  public async create(data: any) {
    // Your server logic here
  }
}
```

When you add that `use public` directive at the top, something interesting happens during the build. The build tool looks at your service and says, "Okay, this needs to be accessible over HTTP," and it generates a complete controller for you:

```ts
@Controller("/app", {
  providedIn: "root",
})
export class AppAutoController {
  constructor(private appService: AppService) {}

  @Post("create")
  async create(@Body() body: unknown) {
    const validated = userIn.parse(body);
    const result = await this.appService.create(validated.data);
    return userOut.parse(result);
  }
}
```

Notice what happened there. You provided Zod schemas in the `@Signature` decorator, and the generated controller automatically validates incoming data and outgoing responses. You didn't write any of that validation code yourself.

## The Real Magic Happens on the Client

Now here's where it gets cool. In your frontend component, you can just call the service directly:

```tsx
"use client";

@Component()
export class AppComponent {
  constructor(private appService: AppService) {}

  build() {
    return (
      <button onClick={async () => await this.appService.create({...})}>
        submit
      </button>
    );
  }
}
```

Wait, what? We're calling `AppService.create` from the browser? But that's server code. It has database calls, business logic, all sorts of things that shouldn't be in a client bundle.

And you'd be absolutely right to be concerned. So what's actually happening here?

## The Clever Part: Stubs

The build tool is actually pretty smart. When it bundles your client code, it doesn't include the real `AppService` with all that sensitive server logic. Instead, it generates a stub version that looks identical on the outside but does something completely different on the inside:

```ts
@Injectable()
export class AppService {
  async create(data: any) {
    const res = await fetch("/app/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    return res.json();
  }
}
```

This stub gets bundled with your client code. It has the same method signature, but under the hood it's making a fetch call to the server endpoint that was auto-generated earlier.

From your perspective as a developer, you never wrote `fetch`. You just called a method. The network call is completely abstracted away. And because TypeScript sees the same interface on both sides, you get full type safety across the network boundary.

Pretty neat, right?

## What Gets Turned Into an Endpoint?

The build tool has some rules about what it will generate endpoints for. A method needs to be:

- Marked as `public`
- Either `async` or returning a `Promise` or `Observable`

That's it. If your method meets those criteria and lives in a service with `use public`, you get an endpoint.

## Clean, Predictable URLs

One thing worth mentioning: Orca doesn't try to hide or obfuscate your endpoints. The generated routes are clean and predictable. This might seem like a small detail, but it's actually pretty important.

It means you can use these same endpoints from mobile apps, third-party integrations, or anywhere else you need an API. You're not locked into a framework-specific approach. You're just building a normal REST API, but without having to write all the boilerplate yourself.

## Streaming Gets the Same Treatment

Let's say you're building something with streaming data, like an LLM response. You want server-sent events. Normally, you'd write SSE endpoints on the server, then EventSource code on the client, and make sure they're talking the same language.

With Orca, you just return an Observable:

```ts
"use public";

@Injectable()
export class AppService {
  // Must be public
  // Return type must be explicitly annotated
  public stream(prompt: string): Observable<string> {
    return observable((o) => {
      setInterval(() => o.next("chunk"), 1000);
    });
  }
}
```

The build tool sees that Observable return type (which you need to explicitly annotate, since it can't infer it) and generates an SSE endpoint:

```ts
@Controller("/app", {
  providedIn: "root",
})
export class AppAutoController {
  constructor(private appService: AppService) {}

  @Sse("stream")
  async stream(@Query() prompt: string) {
    return this.appService.stream(prompt);
  }
}
```

And on the client side, you just use it like any other Observable:

```tsx
"use client";

@Component()
export class AppComponent {
  constructor(private appService: AppService) {}

  build() {
    let chunk = signal("");

    let llmResponse = this.appService.stream("Hello");

    llmResponse.subscribe((val) => {
      chunk.value = val;
    });

    return <div>{chunk.value}</div>;
  }
}
```

Behind the scenes, the client stub is handling all the EventSource machinery:

```ts
@Injectable()
export class AppService {
  async stream(prompt: any) {
    return new Observable((observer) => {
      const eventSource = new EventSource(`/app/stream?prompt=${prompt}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          observer.next(data);
        } catch (error) {
          observer.error?.(error);
        }
      };
    });
  }
}
```

You never had to think about SSE. You just returned an Observable and subscribed to it. The framework figured out the rest.

## What's Still Missing

There's one piece we haven't quite solved yet. What about decorators like `@UseGuard()` that handle authentication and authorization?

```ts
"use public";

@Injectable()
export class AppService {
  @UseGuard() // Should this go on the auto-generated controller?
  public async orcas_secret() { ... }
}
```

We need a way for the build tool to know which decorators should be lifted up to the HTTP layer and which ones should stay with the service. Guards, interceptors, and other HTTP-level concerns probably belong on the controller. But other decorators might be specific to the service implementation.

This is the kind of thing we're still working through. The goal is to make it intuitive and automatic, just like everything else.
