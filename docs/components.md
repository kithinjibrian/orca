# How Orca Renders Components: A Comprehensive Guide

## Understanding Server-Side and Client-Side Rendering

Components in Orca are rendered on the server by default. This server-first approach provides significant benefits: you can fetch data directly from databases, perform authentication checks, access file systems, and execute other operations that should remain on the server for security or performance reasons.

However, not all components belong on the server. Client components that respond to user input, maintain local state, or leverage browser APIs need to run in the client environment. To designate a component for client-side rendering, you explicitly opt in using the `use client` directive at the top of your component file.

## Client Components

Client components are marked with the `use client` directive and run in the browser. They have access to browser APIs, can handle user interactions, and maintain client-side state.

```tsx
// btn.component.tsx (rendered on the client)
"use client";
import { Component } from "@kithinji/orca";

@Component()
export class Btn {
  build() {
    return <button onClick={() => {}}>Click me</button>;
  }
}
```

The `onClick` handler in this example requires JavaScript execution in the browser, which is why this component must be marked as client and rendered on the client.

## Server Components

Server components don't require the `use client` directive. They render on the server and can perform server-side operations without exposing sensitive logic or credentials to the client.

```tsx
// h1.component.tsx (rendered on the server)
import { Component } from "@kithinji/orca";

@Component()
export class H1 {
  build() {
    return <h1>Header</h1>;
  }
}
```

One of the most powerful features of server components is their ability to be asynchronous. This allows you to perform data fetching, database queries, or other async operations directly within your component:

```tsx
// async_h1.component.tsx (rendered on the server)
import { Component } from "@kithinji/orca";

@Component()
export class AsyncH1 {
  async build() {
    // Fetch data from database, API, etc.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return <h1>Header</h1>;
  }
}
```

## The Bundling Strategy

Now here's where things get interesting: how does Orca handle bundling when you have a mix of server and client components in the same application?

The answer is elegant: **both the server and client receive complete copies of the component tree, but with strategic stubbing**.

- **Client components** are included in the server build as stubs (placeholders)
- **Server components** are included in the client build as stubs (placeholders)

This allows each environment to have a complete understanding of the component tree structure while only executing the components appropriate for that environment.

## Walking Through the Rendering Process

Let's trace the complete rendering flow using this component tree:

```
            HomePage[server]
          /                  \
         /                    \
    Card[client]                Footer[server]
     /         \                            \
    /           \                            \
Header[server]  Action[client]              Button[client]
```

This tree contains:

- **Server components**: HomePage, Header, Footer
- **Client components**: Card, Action, Button

### Phase 1: Initial Server Render

When a user navigates to the home page, the server begins the rendering process:

**Step 1**: The server starts rendering `HomePage` because it's a server component. Since components form a tree structure, rendering HomePage requires traversing the entire tree beneath it.

**Step 2**: Moving down the left branch, the server encounters `Card`. This is a client component, and its actual implementation code isn't available in the server bundle (it's been stubbed). The server cannot and should not render it. Instead, the server creates a special marker object that tells the browser: "There's a client component here that you need to render." The server stops processing this branch at this point.

**Step 3**: Moving to the right branch, the server encounters `Footer`, which is a server component. The server renders it completely, executing its `build()` method and generating the final markup.

**Step 4**: Continuing down from Footer, the server encounters `Button`, another client component. Just like with Card, the server creates a marker object pointing to Button and stops processing.

At this point in the render, only two components have been fully executed on the server: `HomePage` and `Footer`. The server has created a structure that looks like this:

```json
{
  "$$typeof": "orca.component",
  "type": "HomePage",
  "props": {
    "children": [
      {
        "$$typeof": "orca.client.component",
        "type": "Card",
        "props": {
          "path": "public/src/card.js"
        }
      },
      {
        "$$typeof": "orca.component",
        "type": "Footer",
        "props": {
          "children": [
            {
              "$$typeof": "orca.client.component",
              "type": "Button",
              "props": {
                "path": "public/src/button.js"
              }
            }
          ]
        }
      }
    ]
  }
}
```

This object is a mix of:

- Fully rendered server components (HomePage, Footer)
- Pointers to client components (Card, Button) with paths to their implementations

The server sends this object to the browser.

### Phase 2: Client-Side Hydration

Once the browser receives the server's response, it takes over the rendering process:

**Step 1**: The browser's Orca runtime walks through the received object tree, looking for any entries marked with `$$typeof: "orca.client.component"`.

**Step 2**: For each client component it finds, the runtime extracts the `path` property and dynamically imports the component:

```ts
const module = await import(path); // e.g., "public/src/card.js"

const instance = new module[ComponentName]();
const result = instance.build();
```

**Step 3**: When the browser renders `Card`, it discovers that Card has children: `Header` and `Action`.

**Step 4**: The browser attempts to render `Header`, but Header is a server component. The browser's version of Header is just a stub that knows to fetch the real rendering from the server:

```ts
@Component()
export class Header {
  build() {
    const anchor = document.createElement("div");

    // Fetch the server-rendered version
    fetch("/osc?c=Header").then((jsx) => {
      const html = jsxToDom(jsx);
      anchor.replaceChild(html);
    });

    return anchor;
  }
}
```

**Step 5**: The browser makes a request back to the server: "Please render Header for me." The server renders Header and sends back the result.

**Step 6**: The browser continues rendering `Action`, which is a client component, so it renders it directly in the browser.

**Step 7**: Eventually the browser renders `Button` (client component) and the entire tree is complete.

### The Ping-Pong Pattern

As you can see, rendering a mixed component tree creates a ping-pong pattern:

1. **Server** renders HomePage → encounters client component Card → sends pointer
2. **Browser** receives pointer → imports Card → renders Card → encounters server component Header
3. **Server** receives request → renders Header → sends result
4. **Browser** receives Header → continues rendering Action (client)
5. **Browser** renders Button (client)
6. Complete!

This back-and-forth continues until every component in the tree has been rendered in its appropriate environment.

## The Build Output: Two Complete Trees

To support this ping-pong rendering pattern, Orca's build process creates two versions of your component tree:

### Client Bundle

The client bundle contains the component tree structure, but with server components stubbed:

```
Card[client - full implementation]
 /                               \
/                                 \
Header[client - stubbed]         Action[client - full implementation]           Button[client - full implementation]
```

The stubbed version of `Header` in the client bundle looks like this:

```ts
@Component()
export class Header {
  build() {
    const anchor = document.createElement("div");

    // In production, this uses observables for streaming
    fetch("/osc?c=Header").then((jsx) => {
      const html = jsxToDom(jsx);
      anchor.replaceChild(html);
    });

    return anchor;
  }
}
```

This stub creates a placeholder element and fetches the actual rendered content from the server.

### Server Bundle

The server bundle also contains the component tree structure, but with client components stubbed:

```
HomePage[server - full implementation]
  /                                 \
 /                                   \
Card[server - stubbed]            Footer[server - full implementation]
                                                                     \
                                                                      \
                                                                    Button[server - stubbed]

Header[server - full implementation] exists in an island
```

The stubbed version of `Card` in the server bundle looks like this:

```ts
@Component()
export class Card {
  build() {
    return {
      $$typeof: "orca.client.component",
      props: {
        path: "public/src/card.js",
      },
    };
  }
}
```

This stub doesn't try to render Card. Instead, it returns a marker object that tells the renderer: "This is a client component, and here's where the browser can find its implementation."

# Summary

Orca's rendering model is built on a simple principle: render components where they make the most sense. Server components run on the server with access to databases and APIs. Client components run in the browser with access to user interactions and browser APIs.

The magic happens in the build process, which creates two strategically stubbed versions of your component tree. This enables a seamless ping-pong rendering pattern where each component is rendered in its optimal environment, with automatic coordination between server and client.

The result is an architecture that's both powerful and intuitive: you declare where components should run with `use client`, and Orca handles the rest.
