<h1 align="center">Orca</h1>
<p align="center">
<img src="https://i.postimg.cc/Wpq8CWvV/orca.png" alt="orca-logo" width="150px"/>
<br>
<em>One codebase. One deployment.
<br> Build full-stack applications without the frontend/backend divide.</em>
<br>
</p>
<p align="center">
<a href="https://orca.dafifi.net/"><strong>orca.dafifi.net</strong></a>
<br>
</p>
<p align="center">
<a href="https://www.npmjs.com/package/@kithinji/orca">
<img src="https://img.shields.io/badge/NPM_package-v1.0.16-blue" alt="Orca on npm" />
</a>
</p>

<hr>

## The Problem

Modern web apps require two separate projects: one for the frontend, one for the backend. This means:

- Two repositories to maintain
- Two deployment pipelines
- Two sets of dependencies
- Manual API contracts that constantly drift
- Endless context switching between different codebases

Building a single feature requires touching multiple repos, keeping types in sync manually, and spending more time wiring things together than actually building.

**Orca solves this by unifying your entire stack in one codebase.**

---

## What is Orca?

Orca is a full-stack TypeScript framework that lets you build your entire application (API, business logic, and UI) in a single codebase.

Write your backend services, frontend components, and API endpoints together with shared types and zero boilerplate.

### Inspired By

- **NestJS** for backend architecture (dependency injection, decorators, modules)
- **Angular** for frontend structure (class-based components, clear organization)
- **Islands Architecture** for optimal performance (server-render by default, hydrate selectively)

### How It Works

Orca uses three simple directives to control where code runs:

**1. Default: Server Components**

Components render on the server by default. Fast initial loads, works without JavaScript.

```tsx
@Component()
export class ProductList {
  constructor(private products: ProductService) {}

  async build() {
    const items = await this.products.getAll();
    return (
      <div>
        {items.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    );
  }
}
```

**2. `"use client"` for Client Components**

Add this directive when you need client-side interactivity like click handlers, forms, or animations.

```tsx
"use client";
import { Component, signal } from "@kithinji/orca";

@Component()
export class AddToCartButton {
  constructor(private cart: CartService) {}

  props!: { productId: number };
  private adding = signal(false);

  build() {
    return (
      <button
        disabled={this.adding.value}
        onClick={async () => {
          this.adding.value = true;
          await this.cart.addItem(this.props.productId);
          this.adding.value = false;
        }}
      >
        {this.adding.value ? "Adding..." : "Add to Cart"}
      </button>
    );
  }
}
```

**3. `"use public"` for Auto-Generated APIs**

Mark services with this directive to automatically create type-safe API endpoints.

```tsx
"use public";
import { Injectable } from "@kithinji/orca";

@Injectable()
export class CartService {
  // This becomes: POST /cart/addItem
  public async addItem(productId: number) {
    const item = await this.db.products.findUnique({ where: { productId } });
    return this.db.cart.create({ data: { productId, quantity: 1 } });
  }

  // This becomes: GET /cart/getTotal
  public async getTotal() {
    return this.db.cart.aggregate({ _sum: { price: true } });
  }
}
```

When you call `this.cart.addItem()` from a client component, Orca automatically:

1. Generates the `/cart/addItem` endpoint
2. Serializes your function call into a fetch request
3. Validates input on the server
4. Executes your server-side logic
5. Returns the typed response

**No manual API calls. No type drift. Just call methods like they're local.**

---

## Why Use Orca?

### Type Safety Across Your Entire Stack

Your types never drift because they're literally the same types. Change a service method's signature and TypeScript catches every call site instantly, whether it's in a server component, client component, or controller.

### Less Boilerplate, More Features

```tsx
// Traditional approach: Define API route, write fetch call, handle errors
const response = await fetch("/api/cart/add", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ productId }),
});
const data = await response.json();

// Orca: Just call the method
await this.cart.addItem(productId);
```

### Islands Architecture for Performance

Server-render everything by default for fast initial loads. Add `"use client"` only to components that need client-side JavaScript. Your page stays lightweight while still providing rich interactivity where needed.

### Clear Architecture That Scales

Dependency injection, decorators, and modules keep your code organized as your application grows. No more tangled mess of utility functions and scattered business logic.

---

## Quick Start

### Installation

Install the Orca CLI globally:

```bash
npm install -g @kithinji/pod
```

### Create a New Project

```bash
pod new my-app
cd my-app
npm run dev
```

Open your browser to `http://localhost:8080` to see your app.

### Requirements

- Node.js v20.9 or higher
- A text editor (VS Code recommended)

---

## Project Structure

```
src/
├── features/
│   ├── user/
│   │   ├── user.service.ts          # Business logic
│   │   ├── user.controller.ts       # HTTP endpoints (optional)
│   │   ├── pages/
│   │   │   ├── user-profile.page.tsx
│   │   │   └── user-login.page.tsx
│   │   ├── components/
│   │   │   └── avatar.component.tsx
│   │   └── user.module.ts           # Feature module
│   └── product/
│       ├── product.service.ts
│       ├── components/
│       └── product.module.ts
└── app.module.ts                     # Root module
```

Organize by feature, not by technical layer. Everything related to "products" lives in the products folder.

---

## Core Concepts

### Services (Business Logic Layer)

Services contain your application logic. They're injectable classes that can be used anywhere.

```typescript
"use public";
import { Injectable, Signature, Observable } from "@kithinji/orca";
import { z } from "zod";

const GetProductSchema = z.object({ id: z.number() });
const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
});

@Injectable()
export class ProductService {
  constructor(private db: DatabaseService) {}

  @Signature(GetProductSchema, ProductSchema)
  public async getProduct(id: number) {
    return this.db.products.findUnique({ where: { id } });
  }

  public async listProducts() {
    return this.db.products.findMany();
  }

  // Type annotate with Observable for Server-Sent Events
  public stream(): Observable<number> {
    // Implementation
  }
}
```

The `@Signature` decorator defines validation schemas. Orca uses these to automatically validate requests.

### Components (UI Layer)

Components are classes that return JSX from a `build()` method.

**Server Component:**

```tsx
@Component()
export class ProductList {
  constructor(private products: ProductService) {}

  async build() {
    const items = await this.products.listProducts();

    return (
      <div>
        <h1>Products</h1>
        {items.map((item) => (
          <div key={item.id}>
            <h3>{item.name}</h3>
            <p>${item.price}</p>
            <AddToCartButton productId={item.id} />
          </div>
        ))}
      </div>
    );
  }
}
```

**Client Component:**

```tsx
"use client";
import { Component, signal, toSignal } from "@kithinji/orca";

@Component()
export class AddToCartButton {
  constructor(private cart: CartService, private products: ProductService) {}

  props!: { productId: number };
  private adding = signal(false);

  build() {
    // Streams become EventSource for Server-Sent Events
    const stream = this.products.stream();
    const value = toSignal(stream, this);

    return (
      <button
        onClick={async () => {
          this.adding.value = true;
          await this.cart.addItem(this.props.productId);
          this.adding.value = false;
        }}
      >
        {this.adding.value ? "Adding..." : "Add to Cart"}
      </button>
    );
  }
}
```

### Controllers (HTTP Endpoints)

Controllers define REST endpoints. You can write them manually or let Orca auto-generate them from `"use public"` services.

**Manual Controller:**

```typescript
import { Controller, Get, Post, Body, Param } from "@kithinji/orca";

@Controller("/products")
export class ProductController {
  constructor(private products: ProductService) {}

  @Get()
  async findAll() {
    return this.products.listProducts();
  }

  @Get("/:id")
  async findOne(@Param("id") id: number) {
    return this.products.getProduct(id);
  }

  @Post()
  async create(@Body() data: CreateProductDto) {
    return this.products.create(data);
  }
}
```

**Auto-Generated:**

When you mark a service with `"use public"`, Orca creates endpoints automatically:

- `POST /product/getProduct`
- `GET /product/listProducts`

No controller code required.

### Modules (Organizing Features)

Modules group related functionality and manage dependencies.

```typescript
import { Module } from "@kithinji/orca";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { ProductList, AddToCartButton } from "./components";

@Module({
  imports: [DatabaseModule], // Dependencies
  controllers: [ProductController], // HTTP endpoints
  providers: [ProductService], // Services
  declarations: [ProductList, AddToCartButton], // UI components
  exports: [ProductService, ProductList], // What other modules can use
})
export class ProductModule {}
```

### Navigation (Stack-Based Routing)

Instead of file-based routing, push components onto a navigation stack.

```tsx
import { Navigate, Component } from "@kithinji/orca";

@Component({
  route: "/home/:id?location&browser*",
})
export class HomePage {
  props!: {
    id: string;
    location: string;
    browser?: string;
  };

  constructor(private navigate: Navigate) {}

  build() {
    return (
      <div>
        <h1>Welcome</h1>
        <button onClick={() => this.navigate.push(<UserProfile userId={1} />)}>
          View Profile
        </button>
      </div>
    );
  }
}
```

**Navigation Methods:**

- `push()` - Navigate to a new page
- `pop()` - Go back to previous page
- `replace()` - Replace current page
- `popToRoot()` - Clear stack and return to root
- `canPop()` - Check if back navigation is possible

**Using `<a>` tags:**

You can still use anchor tags, but they're not type-safe:

```tsx
<a href="/home/123?location=nairobi&browser=FireFox">To Home</a>
```

### Macros (Compile-Time Code Execution)

Macros are functions that run at build time, letting you inline files, load configurations, and optimize code before it reaches production.

**Built-in Macros:**

```tsx
import { inlineFile$, style$, apply$ } from "@kithinji/arcane";

// Inline file contents at build time
const readme = inlineFile$("README.md");

// Generate scoped CSS
const styles = style$({
  h1: { fontSize: "2rem", color: "#333" },
  p: { lineHeight: 1.6 }
});

<h1 {...apply$(styles.h1)}>Title</h1>
<p {...apply$(styles.p)}>Content</p>
```

**Custom Macros:**

Create your own by naming functions with a `$` suffix:

```ts
// env.macro.ts
import { MacroContext } from "@kithinji/pod";

export function env$(key: string, context?: MacroContext): string {
  const envValue = process.env[context!.resolveNodeValue(key as any)];
  return context!.factory.createStringLiteral(envValue) as any;
}

// Usage
const apiKey = env$("API_KEY"); // Resolved at build time
```

Macros execute during compilation, inlining results directly into your bundle with zero runtime overhead.

---

## Complete Example

Here's how everything works together:

```typescript
// cart.service.ts
"use public";
import { Injectable } from "@kithinji/orca";

@Injectable()
export class CartService {
  constructor(private db: DatabaseService) {}

  public async addItem(productId: number, quantity: number = 1) {
    const product = await this.db.products.findUnique({ where: { productId } });
    return this.db.cart.create({
      data: { productId, quantity, price: product.price },
    });
  }

  public async getCart() {
    return this.db.cart.findMany();
  }
}
```

```tsx
// cart-page.component.tsx
import { Component } from "@kithinji/orca";

@Component()
export class CartPage {
  constructor(private cart: CartService) {}

  async build() {
    const items = await this.cart.getCart();
    return (
      <div>
        <h1>Your Cart</h1>
        {items.map((item) => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
    );
  }
}
```

```tsx
// add-to-cart-button.component.tsx
"use client";
import { Component, Navigate } from "@kithinji/orca";

@Component()
export class AddToCartButton {
  constructor(private cart: CartService, private navigate: Navigate) {}

  props!: { productId: number };

  build() {
    return (
      <button
        onClick={async () => {
          await this.cart.addItem(this.props.productId);
          this.navigate.push(<CartPage />);
        }}
      >
        Add to Cart
      </button>
    );
  }
}
```

**What happens:**

1. `CartService` has `"use public"`, so Orca generates API endpoints
2. `CartPage` (server component) calls `cart.getCart()` on the server during render
3. `AddToCartButton` (client component) calls `cart.addItem()` from the browser
4. Orca converts that call into `fetch('/cart/addItem', ...)`
5. Types are preserved everywhere. TypeScript catches errors before runtime
6. Navigation happens by pushing components, not URL strings

---

## When to Use Orca

**Orca is great for:**

- Solo developers or small teams
- Building features quickly without managing two repos
- Internal tools, dashboards, or admin panels
- Highly client web applications
- Projects where you need a real API (for mobile apps, CLIs, webhooks)
- Teams tired of keeping types in sync between frontend and backend

**Orca might not fit if:**

- You have separate frontend and backend teams
- You prefer the traditional split and it works for you
- You need a purely client-side SPA
- You're building a static marketing site or blog (use Astro or Next.js)
- Your team is heavily invested in another stack

---

## Orca vs. Alternatives

### Why not separate repos?

Separate repos mean double the maintenance. Two sets of types that drift. Two deployment pipelines. Constant context switching. For solo devs or small teams, you spend more time connecting things than building.

### Why not Next.js?

Next.js excels at rendering UI fast, but it's optimized for frontend-first development. The moment you need a proper backend with controllers, services, and dependency injection, things get messy. Server Actions blur the lines between UI and backend in ways that make larger apps hard to maintain.

Orca gives you a real backend architecture with clean separation of concerns, plus UI rendering that integrates naturally.

### Why not HTMX?

HTMX is elegant for server-rendered apps. But endpoints that return HTML lock you in. When you need a mobile app, CLI, or webhook consumer, you either build a second JSON API or parse HTML on the client.

Orca's API returns JSON by default. UI rendering is a layer on top, not a replacement. You're never painted into a corner.

---

## Philosophy

Orca rejects the artificial divide between frontend and backend. For large teams with dedicated specialists, that split makes sense. But for solo developers and small teams, it doubles the work.

### Core Principles

**One Codebase** - Write features end to end in one place

**Islands of Interactivity** - Server-render by default, add JavaScript only where needed

**Type-Safe APIs** - No manual fetch calls, no drifting types

**Clear Architecture** - Dependency injection, decorators, and modules keep large apps maintainable

**Stack-Based Navigation** - Route by pushing components, not folder structures

This is opinionated software. It has rules, structure, and conventions. The rules exist to free you from decision fatigue so you can focus on building.

---

## Documentation

Full guides, API references, and examples at [**orca.dafifi.net**](https://orca.dafifi.net/)

**Topics covered:**

- Components and JSX
- Dependency Injection
- Modules and Providers
- Controllers and Routing
- The `"use client"` directive
- The `"use public"` directive
- Signals and Reactivity
- Observables and Server-Sent Events
- Navigation Stack
- Macros and Compile-Time Execution
- Validation with Zod

---

## Roadmap

- [ ] Database integrations (TypeORM, Prisma)
- [ ] Authentication and authorization modules
- [ ] WebSocket support
- [ ] GraphQL adapter
- [ ] CLI scaffolding improvements
- [ ] File upload handling
- [ ] Background jobs and task queues

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## Stay Connected

- **Author**: [Kithinji Brian](https://www.linkedin.com/in/kithinjibrian/)
- **Website**: [orca.dafifi.net](https://orca.dafifi.net/)
- **NPM**: [@kithinji/orca](https://www.npmjs.com/package/@kithinji/orca)
- **Whatsapp Group** [The Orca Project](https://chat.whatsapp.com/ESCKE1t6Exc0ZagzCA6RNc)

---

## License

MIT

---

<p align="center">
Made in Nairobi with ❤️ for developers who just want to ship
</p>
