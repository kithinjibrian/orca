In the previous article, we talked about dependency injection. That usually leads to a natural question:

**How does the framework know how to create these things?**

That is where providers come in.

---

## What Is a Provider?

A provider is an instruction to Orca’s DI container that says: **“This is how you create this thing when someone asks for it.”**

The simplest provider is just a class:

```ts
@Injectable()
class DatabaseService {
  connect() {
    // implementation
  }
}
```

When you mark a class with `@Injectable()`, you are registering a provider. The container sees this and knows that when something needs a `DatabaseService`, it should create an instance of that class.

That is just the starting point. Providers can do much more.

---

## Why Providers Exist

Not everything you inject is a class you own.

Sometimes you need to inject:

- Configuration values
- Third-party libraries not designed for DI
- Different implementations per environment
- Computed values that depend on other services
- Singletons with custom initialization

Providers are the mechanism that makes all of this possible, without leaking complexity into your application code.

---

## Types of Providers

Orca supports several provider types, each solving a different problem.

### 1. Class Providers

This is the default behavior when you use `@Injectable()`:

```ts
@Injectable()
class EmailService {
  send(to: string, message: string) {
    // send email
  }
}
```

The container understands that when `EmailService` is requested, it should create an instance of this class.

You can also register it explicitly in a module:

```ts
@Module({
  providers: [
    EmailService,
    // equivalent to:
    // { provide: EmailService, useClass: EmailService }
  ],
})
class AppModule {}
```

This is the most common and simplest form of provider.

---

### 2. Value Providers

Sometimes you just need to inject a constant, such as configuration:

```ts
const API_KEY = "sk_live_abcd1234";

@Module({
  providers: [{ provide: "API_KEY", useValue: API_KEY }],
})
class AppModule {}
```

You can then inject it like any other dependency:

```ts
@Injectable()
class PaymentService {
  constructor(@Inject("API_KEY") private apiKey: string) {}

  charge(amount: number) {
    // use this.apiKey
  }
}
```

**Use cases:** environment variables, feature flags, and static configuration.

---

### 3. Factory Providers

Some objects need logic to be created. They might require configuration, setup, or conditional behavior.

Factory providers let you control that process:

```ts
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: () => {
        const db = new DatabaseService();
        db.connect(process.env.DB_URL);
        return db;
      },
    },
  ],
})
class AppModule {}
```

Factories can also depend on other services:

```ts
@Module({
  providers: [
    {
      provide: CacheService,
      useFactory: (config: ConfigService) => {
        return new CacheService({
          ttl: config.get("CACHE_TTL"),
          maxSize: config.get("CACHE_SIZE"),
        });
      },
      inject: [ConfigService],
    },
  ],
})
class AppModule {}
```

**Use cases:** complex initialization, conditional creation, wrapping third-party libraries.

---

### 4. Alias Providers

Sometimes multiple tokens should resolve to the same instance:

```ts
@Injectable()
class PostgresDatabase implements Database {
  // implementation
}

@Module({
  providers: [
    PostgresDatabase,
    { provide: Database, useExisting: PostgresDatabase },
  ],
})
class AppModule {}
```

Now both `Database` and `PostgresDatabase` resolve to the same object:

```ts
@Injectable()
class UserService {
  constructor(private db: Database) {}
}
```

**Use cases:** interfaces, backward compatibility, or multiple tokens for the same service.

---

### 5. Class-to-Class Providers

You can also map one class to another, which is useful for swapping implementations:

```ts
@Module({
  providers: [{ provide: EmailService, useClass: FakeEmailService }],
})
class DevModule {}

@Module({
  providers: [{ provide: EmailService, useClass: SendGridEmailService }],
})
class ProdModule {}
```

Your application always depends on `EmailService`. The actual implementation depends on the environment.

**Use cases:** development vs production, testing, feature flags.

---

## Provider Scope

By default, providers are singletons. One instance is shared across the application.

You can change that behavior:

```ts
@Injectable({ scope: "transient" })
class RequestHandler {
  // new instance on every injection
}

@Injectable({ scope: "singleton" })
class ConfigService {
  // single instance for the app
}
```

**Guidelines:**

- **Singleton:** configuration, caches, database connections
- **Transient:** stateless services or services that require isolation

---

## A Real Example

Here is a payment system that behaves differently in development and production.

```ts
export interface PaymentService {
  charge(amount: number, token: string): Promise<PaymentResult>;
}

@Injectable()
export class FakePaymentService implements PaymentService {
  async charge(amount: number) {
    console.log(`FAKE: Charged $${amount}`);
    return { success: true, transactionId: "fake_" + Date.now() };
  }
}

@Injectable()
export class StripePaymentService implements PaymentService {
  constructor(@Inject("STRIPE_API_KEY") private apiKey: string) {}

  async charge(amount: number, token: string) {
    const result = await stripe.charges.create({
      amount: amount * 100,
      currency: "usd",
      source: token,
    });
    return { success: true, transactionId: result.id };
  }
}
```

```ts
@Module({
  providers: [{ provide: "PaymentService", useClass: FakePaymentService }],
})
export class DevModule {}

@Module({
  providers: [
    { provide: "STRIPE_API_KEY", useValue: process.env.STRIPE_API_KEY },
    { provide: "PaymentService", useClass: StripePaymentService },
  ],
})
export class ProdModule {}
```

```ts
@Injectable()
export class CheckoutService {
  constructor(
    @Inject("PaymentService") private payment: PaymentService
  ) {}

  async processOrder(amount: number, token: string) {
    return this.payment.charge(amount, token);
  }
}
```

**What this gives you:**

- No environment checks in business logic
- Easy testing with fake implementations
- One-line provider swaps
- Code that depends on behavior, not concrete classes

---

## Common Patterns

### Configuration Objects

```ts
@Module({
  providers: [
    {
      provide: "APP_CONFIG",
      useValue: {
        apiUrl: process.env.API_URL || "http://localhost:3000",
        timeout: 5000,
        retries: 3,
      },
    },
  ],
})
class AppModule {}
```

### Async Factories

```ts
@Module({
  providers: [
    {
      provide: DatabaseService,
      useFactory: async (config: ConfigService) => {
        const db = new DatabaseService();
        await db.connect(config.get("DB_URL"));
        return db;
      },
      inject: [ConfigService],
    },
  ],
})
class AppModule {}
```

### Optional Dependencies

```ts
@Injectable()
class AnalyticsService {
  constructor(
    @Inject("ANALYTICS_KEY", { maybe: true }) private key?: string
  ) {}

  track(event: string) {
    if (!this.key) return;
    // send analytics event
  }
}
```

---

## Why This Matters

Providers give you flexibility without spreading complexity:

- Swap implementations cleanly
- Centralize configuration
- Decouple services from concrete dependencies
- Test without touching production code

You define providers once. The rest of your code simply asks for what it needs.

---

Providers are how Orca’s dependency injection system knows what to create and how to create it.

They give you control over:

- What gets created
- How it is created
- When it is created
- How many instances exist

Start with class providers. Reach for the others when you need configuration, testing, or environment-specific behavior.

When that moment comes, providers are ready.

**That is their real power: simplicity by default, flexibility when it matters.**