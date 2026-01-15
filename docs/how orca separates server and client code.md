# How Orca Separates Server and Client Code

Orca is the framework where you get to build your web application as one codebase. You'll never have to create two projects - a frontend and a backend. While that takes the problem away from the developer, it throws the hot potato back to the platform to separate itself into a frontend and a backend.

So how does that happen?

## The Two-Pass Compilation System

Orca builds code in **two passes**.

### Pass 1: The Server Pass

The first pass is the **server pass**, which compiles all server-to-be code. Something also important that it does in this pass is skip and register component files marked with `"use client"`.

By "skipping," I don't mean literally ignoring them. While it doesn't compile client files with the `"use client"` directive, it **does generate stubs** - which means all server code will always be in a consistent state.

Here's what a server component looks like:

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

And here's what a client component looks like:

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

### Stubbing Client Components in the Server Bundle

During the server pass, when Orca encounters `Btn` (the client component), it generates a stub that looks like this:

```ts
// Stubbed version in server bundle
@Component()
export class Btn {
  build() {
    return {
      $$typeof: "orca.client.component",
      props: {
        path: "public/src/btn.js",
      },
    };
  }
}
```

This stub doesn't try to render the component. Instead, it returns a **marker object** that says: "This is a client component, and here's where the browser can find its implementation."

Please read more on [how Orca renders components](https://github.com/kithinjibrian/orca/blob/main/docs/how%20orca%20renders%20components.md).

After the server pass, we have:

- Compiled server components (full implementation)
- Stubbed client components (return marker objects)
- A registry of client component files

## Building the Client Dependency Graph

Before we proceed to the second pass, we have to **yank all client code** by building a graph.

We use the client component files as entry points and walk all of them, creating a graph of all their imports.

### Example Component Tree

Let's say we have this component tree:

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

### Walking the Graph

The build system walks from the client entry points (`Card`, `Action`, `Button`) and discovers all their dependencies:

```
Graph Walk Starting Points:

Entry Point 1: Card (client)
  └─> imports: Header (server), Action (client)

Entry Point 2: Action (client)
  └─> imports: (none)

Entry Point 3: Button (client)
  └─> imports: (none)


Discovered Dependencies:

Client components: [Card, Action, Button]
Server components referenced by client: [Header]
```

This graph tells us exactly what needs to be in each bundle.

## Pass 2: The Client Pass

Now that we have the dependency graph, we proceed to the **client pass**. This pass:

1. **Bundles all client components** with their full implementations
2. **Generates stubs for server components** that are referenced by client code
3. **Creates the client JavaScript bundle**

### Stubbing Server Components in the Client Bundle

When a client component depends on a server component (like `Card` depends on `Header`), Orca generates a stub in the client bundle:

```ts
// Header stub in client bundle
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

This stub creates a placeholder and fetches the actual rendered content from the server.

## The Two Bundles

After both passes, we have two complete bundles:

### Server Bundle

```
Server Bundle Contents:

✓ HomePage (full implementation)
✓ Header (full implementation)
✓ Footer (full implementation)
✓ Card (stub - returns marker object)
✓ Action (stub - returns marker object)
✓ Button (stub - returns marker object)
```

Client component stubs in the server bundle:

```ts
@Component()
export class Card {
  build() {
    return {
      $$typeof: "orca.client.component",
      props: { path: "public/src/card.js" },
    };
  }
}
```

### Client Bundle

```
Client Bundle Contents:

✓ Card (full implementation)
✓ Action (full implementation)
✓ Button (full implementation)
✓ Header (stub - fetches from server)
```

Server component stubs in the client bundle:

```ts
@Component()
export class Header {
  build() {
    const anchor = document.createElement("div");
    fetch("/osc?c=Header").then((jsx) => {
      const html = jsxToDom(jsx);
      anchor.replaceChild(html);
    });
    return anchor;
  }
}
```

## Visual Representation of the Separation

```
Source Code Tree:

HomePage[server]
├── Card[client]
│   ├── Header[server]
│   └── Action[client]
└── Footer[server]
    └── Button[client]

            │
            │ TWO-PASS COMPILATION
            

Server Bundle:                Client Bundle:

HomePage                      Card 
├── Card (stub)                ├── Header (stub)
│   ├── Header                 └── Action
│   └── Action (stub)
└── Footer                    Button 
    └── Button (stub)
```

## The Build Process Flow

```
Source Files
    │
    ├── HomePage.tsx (server)
    ├── Card.tsx ("use client")
    ├── Header.tsx (server)
    ├── Action.tsx ("use client")
    ├── Footer.tsx (server)
    └── Button.tsx ("use client")
    │
┌─────────────────────────────────────┐
│  PASS 1: SERVER COMPILATION         │
├─────────────────────────────────────┤
│  Compile: HomePage, Header, Footer  │
│  Stub: Card, Action, Button         │
│  Register: [Card, Action, Button]   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  GRAPH BUILDING                     │
├─────────────────────────────────────┤
│  Entry points: [Card, Action, Button]│
│  Walk imports from client files     │
│  Discover: Header (server dep)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PASS 2: CLIENT COMPILATION         │
├─────────────────────────────────────┤
│  Compile: Card, Action, Button      │
│  Stub: Header                       │
└──────────────┬──────────────────────┘
               │
               ▼
        Two Bundles:
    server.js  |  client.js
```

## How Stubs Differ Between Bundles

The key insight is that **stubs serve different purposes** depending on which bundle they're in:

### Server-Side Stubs (for client components)

```ts
// Purpose: Signal to the renderer that this needs client-side execution
@Component()
export class Card {
  build() {
    return {
      $$typeof: "orca.client.component",
      props: { path: "public/src/card.js" },
    };
  }
}
```

These stubs **don't execute the component**. They return a marker that says "send this path to the browser."

### Client-Side Stubs (for server components)

```ts
// Purpose: Fetch server-rendered output when needed
@Component()
export class Header {
  build() {
    const anchor = document.createElement("div");
    fetch("/osc?c=Header").then((jsx) => {
      const html = jsxToDom(jsx);
      anchor.replaceChild(html);
    });
    return anchor;
  }
}
```

These stubs **do execute**, but they fetch the actual rendering from the server instead of trying to render locally.

## Conclusion

Orca's separation mechanism works through stubbing:

1. **Pass 1** compiles server code and creates stubs for client components (marker objects)
2. **Graph building** identifies all dependencies from client entry points
3. **Pass 2** compiles client code and creates stubs for server components (fetch calls)

The result: **Both bundles have the complete component tree structure**, but each bundle only has the full implementation for components that belong in that environment. Everything else is a stub.

This is how Orca maintains a single codebase while cleanly separating server and client code.
