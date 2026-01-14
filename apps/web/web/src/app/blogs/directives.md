# The Two Directives That Make Orca Work

So you thought you could escape the Next.js `"use client"`, `"use server"` world? 😂

Well, I'm about to break your heart.

Even though Orca prides itself on letting you build web apps in a single repo, the build tool still needs to know how to separate client code from server code. Physics hasn't changed; browsers and servers are still different environments.

---

## 1. `"use client"`

**TL;DR:** This marks components that need to run in the browser.

### The Problem

By default, Orca renders all components on the server. This is fast, and works without JavaScript. But what happens when you need event handlers? What about `onClick`, `onChange`, or browser APIs like `localStorage`?

That's where `"use client"` comes in.

### How It Works

Add `"use client"` at the top of any component file that needs browser functionality. The build tool will bundle it into the client JavaScript and hydrate it on the client side.

```tsx
"use client";
import { Component } from "@kithinji/orca";

@Component()
export class Button {
  build() {
    return <button onClick={() => alert("Hello, World!")}>Click me</button>;
  }
}
```

### The Key Insight

Here's what makes Orca different: **there are no restrictions on which components can call which.**

Server components can render client components. Client components can render server components. It doesn't matter. `"use client"` just creates **islands of interactivity** in your render tree.

---

## 2. `"use public"`

**TL;DR:** This marks services that should be exposed as API endpoints and stubbed on the client.

### The Problem

In Orca, services live in a **limbo state**; they can be bundled in both client and server code. This is perfect for shared logic like formatters, validators, or utilities.

But what about services that talk to databases? Or services that use secret API keys? You absolutely don't want that code leaking to the client bundle.

That's where `"use public"` comes in.

### How It Works

Add `"use public"` to any service file that should only run on the server. The build tool will:

1. Keep the real implementation on the server
2. Generate an API endpoint for each public method
3. Replace the service with a **stub** in the client bundle that calls those endpoints via `fetch`

Here's an example:

```tsx
// app.service.ts
"use public";
import { Injectable } from "@kithinji/orca";

@Injectable()
export class AppService {
  public async get(id: number) {
    // This could be a database call, API key usage, etc.
    return {
      id,
      content: "from server",
    };
  }
}
```

Now use it in an client component:

```tsx
// button.component.tsx
"use client";
import { Component } from "@kithinji/orca";
import { AppService } from "./app.service";

@Component()
export class Button {
  constructor(private readonly appService: AppService) {}

  build() {
    return (
      <button
        onClick={async () => {
          const data = await this.appService.get(1);
          console.log(data);
        }}
      >
        Click me
      </button>
    );
  }
}
```

### What Gets Bundled

It looks like you're calling `appService.get()` directly in client code, but you're not. Here's what actually gets bundled in the client:

```tsx
// app.service.ts (client bundle)
import { Injectable } from "@kithinji/orca";

@Injectable()
export class AppService {
  public async get(id: number) {
    // The build tool automatically generates this fetch call
    const response = await fetch("/AppService/get", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return response.json();
  }
}
```

The button component stays exactly the same - no changes needed.

### Why This Matters

**You almost never have to write `fetch` calls.**

Think about that. No more:

- Manually defining API routes
- Writing fetch boilerplate
- Keeping request/response types in sync
- Debugging mismatched endpoint URLs
- Maintaining separate API client libraries

TypeScript enforces type correctness on what are essentially your API routes. If you rename a parameter, TypeScript errors on both the client and server. If you change a return type, TypeScript catches it everywhere.

---

Here's how to think about these two directives:

- **`"use client"`**: "This component needs to run in the browser."
- **`"use public"`**: "This service should become an API endpoint."

## The Bottom Line

Yes, Orca still needs directives. The client/server boundary is real, and we can't pretend it doesn't exist.

But Orca's directives are:

- **Permissive**: No complex rules about composition
- **Powerful**: They enable type-safe, fetch-free data fetching
