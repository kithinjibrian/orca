As an industry, we don’t appreciate dependency injection enough.

Some of the most battle-tested frameworks, including Spring, Angular, and NestJS, have relied on it for years to build large, long-lived systems. They power massive applications at companies that have survived decades of change.

That is not an accident.

---

## The Trap of “Light” Frameworks

When I started researching design patterns for Orca, I wanted something simple.

I looked at the lightweight frameworks everyone praises, along with the ones I had already used.

At first, lightweight frameworks feel amazing. You move fast. Everything is easy.

Then the app grows.

Features pile up. Files multiply. You grep the codebase just to find where logic lives. Imports turn into a knot. Props get threaded through layer after layer. Refactoring feels risky, so code gets copied instead.

The framework that promised simplicity has no real answer to complexity:

- No clear structure
- No guidance for organizing a growing system
- No way to manage dependencies as they multiply

So you invent your own patterns. Your own conventions. Your own dependency management. You end up building a framework on top of the framework, undocumented, fragile, and living only in your head.

The lightweight framework did not save you time.  
**It just postponed the pain.**

---

## What Dependency Injection Actually Is

**Dependency Injection (DI) is a form of Inversion of Control.**

Instead of creating the things it needs, your code declares its dependencies and receives them from the framework.

### Without DI

```ts
class OrderService {
  private database = new Database();
  private emailer = new EmailService();

  async createOrder(data: OrderData) {
    const order = await this.database.save(data);
    await this.emailer.send(order.email, "Order created!");
    return order;
  }
}
```

This looks simple, but it comes with hidden costs:

- Tight coupling to concrete implementations
- Harder testing
- No lifecycle control
- Dependency chains leaking upward

### With DI

```ts
@Injectable()
class OrderService {
  constructor(
    private database: Database,
    private emailer: EmailService
  ) {}

  async createOrder(data: OrderData) {
    const order = await this.database.save(data);
    await this.emailer.send(order.email, "Order created!");
    return order;
  }
}
```

Now the service declares what it needs without knowing how those dependencies are created. The framework handles wiring, lifecycles, and substitution.

The difference looks small.  
It scales massively.

---

## Why DI Scales

### Explicit Dependencies

A constructor tells you everything a service depends on. No guessing and no spelunking through imports.

### Easy Testing

Testing becomes trivial:

```ts
const mockDb = { save: jest.fn() };
const mockEmailer = { send: jest.fn() };

const service = new OrderService(mockDb, mockEmailer);
```

---

## Common Objections

### “It’s too verbose”

It is more verbose than a single function. But verbosity is not the enemy. **Ambiguity is.**

```ts
export function createOrder(data) {
  // where do dependencies come from?
}
```

vs.

```ts
@Injectable()
class OrderService {
  constructor(private db: Database) {}

  async createOrder(data: OrderData) {}
}
```

The second option is clearer, safer, and far easier to maintain, especially months later.

### “It’s overkill for small projects”

Sometimes. If you are building a throwaway prototype, that is fine.

But projects rarely stay small. Side projects become products. Prototypes become production systems. Rewriting architecture later is expensive.

Starting with patterns that scale lets you avoid that bill.

---

## How Orca Uses DI

Orca’s DI system is inspired by Angular and NestJS, adapted for full-stack web apps.

### Services

```ts
@Injectable()
class UserService {
  constructor(private db: Database) {}

  async findById(id: number) {
    return this.db.query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
  }
}
```

### Controllers

```ts
@Controller("/users")
class UserController {
  constructor(private users: UserService) {}

  @Get("/:id")
  async getUser(@Param("id") id: number) {
    return this.users.findById(id);
  }
}
```

### Components

```tsx
@Component()
class UserProfile {
  props!: { id: number };

  constructor(private users: UserService) {}

  async build() {
    const user = await this.users.findById(this.props.id);
    return <div>{user.name}</div>;
  }
}
```

Everything is connected through DI.

---

## The Long Game

Dependency injection can feel heavy at first. There is more ceremony than a simple function.

But over time, you will notice:

- Refactoring gets easier
- Testing stops being painful
- Structure becomes obvious
- Growth does not turn into chaos

---

## Why Orca Chose DI

Orca uses DI because I wanted a framework that would not fall apart under complexity. One that still made sense months later, and one that let me refactor without fear.

Yes, it is more verbose.  
Yes, there is a learning curve.

But it will not betray you when your app grows.

**Give it a chance. It will grow with you.**