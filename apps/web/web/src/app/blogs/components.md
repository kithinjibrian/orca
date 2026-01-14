# Components: Building Your UI in Orca

Components are the building blocks of the Orca UI layer.

At their core, components are classes decorated with `@Component()` that return JSX from a `build()` method. Nothing more.

---

## Your First Component

Here is the smallest possible component:

```tsx
import { Component } from "@kithinji/orca";

@Component()
export class HelloWorld {
  build() {
    return <h1>Hello, World!</h1>;
  }
}
```

A class. A `build()` method. JSX.

### Why Classes?

Orca is built around dependency injection. Classes give you constructors for injecting services, managing lifecycle, and staying consistent with how controllers and services work.

Functions do not give you that structure.

---

## Props: Passing Data to Components

Components receive input through props, declared explicitly on the class:

```tsx
@Component()
export class Greeting {
  props!: {
    name: string;
    age?: number;
  };

  build() {
    return (
      <div>
        <h1>Hello, {this.props.name}!</h1>
        {this.props.age && <p>Age: {this.props.age}</p>}
      </div>
    );
  }
}
```

### Using the Component

```tsx
@Component()
export class App {
  build() {
    return (
      <div>
        <Greeting name="Alice" />
        <Greeting name="Bob" age={25} />
      </div>
    );
  }
}
```

### Type Safety

The `props!:` syntax uses TypeScript’s definite assignment assertion. It tells TypeScript that Orca will provide these values at runtime.

TypeScript enforces correctness at compile time:

```tsx
<Greeting />              // Error: missing required prop
<Greeting name={42} />    // Error: wrong type
<Greeting name="Alice" /> // Correct
```

### Props Are Immutable

Props flow from parent to child and should never be modified:

```tsx
// Incorrect
this.props.name = "Changed";

// Correct
const displayName = this.props.name.toUpperCase();
```

---

## Declaring Component Dependencies

When a component uses other components, they must be listed in `deps`:

```tsx
import { Button } from "./button.component";
import { Card } from "./card.component";

@Component({
  deps: [Button, Card],
})
export class Dashboard {
  build() {
    return (
      <Card>
        <h1>Dashboard</h1>
        <Button>Click me</Button>
      </Card>
    );
  }
}
```

### Why This Is Required

Orca validates the component dependency graph to ensure:

- Everything used can be rendered at runtime
- Server and client bundles are correct
- Circular dependencies are caught early
- Future lazy loading is possible

Yes, this is extra work. The build tool already parses JSX and could infer this automatically. That logic just has not been implemented yet.

For now, dependencies must be explicit.

### What Happens If You Forget

```tsx
@Component()
export class Dashboard {
  build() {
    return <Button>Click</Button>;
  }
}
```

This results in a runtime error. Orca cannot render a component it does not know about.

---

## JSX in Orca

Orca uses JSX because it is familiar, expressive, and well supported by TypeScript tooling.

### Expressions

```tsx
build() {
  const count = 42;
  return <p>The count is {count}</p>;
}
```

### Conditional Rendering

```tsx
build() {
  const isLoggedIn = !!this.props.user;
  return (
    <div>
      {isLoggedIn ? <p>Welcome back</p> : <p>Please log in</p>}
    </div>
  );
}
```

### Lists

```tsx
build() {
  const items = ["Apple", "Banana", "Cherry"];
  return (
    <ul>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
```

### Fragments

```tsx
build() {
  return (
    <>
      <h1>Title</h1>
      <p>Content</p>
    </>
  );
}
```

### Attributes

```tsx
<input type="text" placeholder="Enter name" />
<button className="primary" disabled>Submit</button>
```

Use `className`, just like React.

---

## Server vs Interactive Components

By default, all Orca components are server-rendered.

They produce HTML only and ship no JavaScript.

### Server Components

```tsx
@Component()
export class Article {
  props!: { title: string; content: string };

  build() {
    return (
      <article>
        <h1>{this.props.title}</h1>
        <p>{this.props.content}</p>
      </article>
    );
  }
}
```

These components cannot use browser APIs or event handlers.

### Interactive Components

Add the `"use interactive"` directive when interactivity is required:

```tsx
"use interactive";
import { Component, signal } from "@kithinji/orca";

@Component()
export class Counter {
  private count = signal(0);

  build() {
    return (
      <div>
        <p>Count: {this.count.value}</p>
        <button onClick={() => this.count.value++}>
          Increment
        </button>
      </div>
    );
  }
}
```

Only the parts that change are re-rendered.

Server and interactive components can be freely mixed.

---

## Async Components

Components can be async, but only on the server.

### Why Async Components Exist

They let you fetch data directly during rendering:

```tsx
@Component()
export class UserProfile {
  constructor(private users: UserService) {}

  props!: { userId: number };

  async build() {
    const user = await this.users.findById(this.props.userId);

    if (!user) {
      return <div>User not found</div>;
    }

    return (
      <div>
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>
    );
  }
}
```

The server waits for data, renders HTML, and sends a complete page to the browser.

### Rules for Async Components

1. Server-only
2. No event handlers
3. Can inject services
4. Can render other async components

### Parallel Fetching

```tsx
@Component()
export class Dashboard {
  async build() {
    return (
      <>
        <UserStats userId={1} />
        <RecentPosts userId={1} />
        <Notifications userId={1} />
      </>
    );
  }
}
```

All child components fetch data in parallel.

---

## Injecting Services into Components

Components use constructor injection like everything else in Orca:

```tsx
@Component()
export class ProductList {
  constructor(private products: ProductService) {}

  async build() {
    const items = await this.products.getAll();

    return (
      <div>
        {items.map(item => (
          <div key={item.id}>
            <h3>{item.name}</h3>
            <p>${item.price}</p>
          </div>
        ))}
      </div>
    );
  }
}
```

### Interactive Components and Public Services

Interactive components can inject `"use public"` services:

```tsx
"use interactive";
@Component()
export class AddToCartButton {
  constructor(private cart: CartService) {}

  props!: { productId: number };

  build() {
    return (
      <button onClick={() => this.cart.addItem(this.props.productId)}>
        Add to Cart
      </button>
    );
  }
}
```

Method calls automatically become network requests.

---

## Component Lifecycle

Server components render once and are done.

```tsx
@Component()
export class Article {
  async build() {
    console.log("Runs once on the server");
  }
}
```

Interactive components update only the parts affected by signals.

There are no hooks or complex lifecycle phases.

---

## Best Practices

### Keep Components Focused

```tsx
@Component()
export class UserDashboard {
  async build() {
    return (
      <>
        <UserProfile userId={this.props.userId} />
        <UserPosts userId={this.props.userId} />
        <UserComments userId={this.props.userId} />
      </>
    );
  }
}
```

### Fetch Data on the Server

Prefer async server components over client fetching.

### Keep Interactive Components Small

Limit them to state and events. Push data and layout upward.

### Declare Dependencies Carefully

```tsx
@Component({
  deps: [Button, Card, Icon],
})
export class Dashboard {
  build() {
    return (
      <Card>
        <Icon name="dashboard" />
        <Button>Action</Button>
      </Card>
    );
  }
}
```

---

## Final Thoughts

Orca components are:

- Class-based
- Dependency-injected
- Server-first
- Explicit by design

Use server and async components for data and layout. Use interactive components only when needed. Keep dependencies clear and services injected.

Components are not isolated UI widgets. They are part of the same system as services and controllers, sharing the same mental model.

That consistency is what makes Orca applications predictable, scalable, and easy to maintain.