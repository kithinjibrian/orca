# Modules: Organizing Your Orca Application

As your application grows, you need a way to organize your code. That's where modules come in.

Modules are containers that group related components, services, and controllers together. They're the organizational backbone of Orca applications, helping you maintain clear boundaries and manage dependencies at scale.

If you've used Angular or NestJS, this will feel immediately familiar. If not, think of modules as folders with superpowers; they don't just contain code, they declare how that code relates to the rest of your application.

---

## What Is a Module?

A module is a class decorated with `@Module()` that defines a cohesive block of functionality.

Here's the basic structure:

```typescript
import { Module } from "@kithinji/orca";

@Module({
  imports: [], // Other modules this module depends on
  declarations: [], // Components this module provides
  providers: [], // Services this module provides
  exports: [], // What this module makes available to others
})
export class AppModule {}
```

Every Orca application has at least one module; the root module. Larger applications split functionality across multiple modules.

---

## Module Properties

Let's break down what each property in `@Module()` does:

### imports

An array of other modules that this module depends on.

```typescript
@Module({
  imports: [DatabaseModule, AuthModule],
})
export class UserModule {}
```

When you import a module, you get access to everything it exports. If `AuthModule` exports `AuthService`, then `UserModule` can inject `AuthService` into its own services and components.

### declarations

An array of components that belong to this module.

```typescript
import { UserProfile, UserList, UserCard } from "./components";

@Module({
  declarations: [UserProfile, UserList, UserCard],
})
export class UserModule {}
```

Declared components are available within the module. If you want other modules to use them, you must also list them in `exports`.

### providers

An array of services that this module provides.

```typescript
import { UserService, UserRepository } from "./services";

@Module({
  providers: [UserService, UserRepository],
})
export class UserModule {}
```

These services can be injected anywhere within the module. Like components, if you want other modules to use them, add them to `exports`.

### exports

An array of components and services that this module makes available to other modules.

```typescript
@Module({
  declarations: [UserProfile, UserList],
  providers: [UserService],
  exports: [UserProfile, UserService], // Only these are accessible to other modules
})
export class UserModule {}
```

`UserList` is declared but not exported, so it's private to `UserModule`. Other modules can't use it.

---

## A Complete Example

Let's build a blog application with multiple modules:

### Post Module

```typescript
// post/post.service.ts
@Injectable()
export class PostService {
  constructor(private db: DatabaseService) {}

  async findAll(): Promise<Post[]> {
    return this.db.posts.findMany();
  }

  async findById(id: number): Promise<Post | null> {
    return this.db.posts.findUnique({ where: { id } });
  }
}

// post/components/post-list.component.tsx
@Component()
export class PostList {
  constructor(private posts: PostService) {}

  async build() {
    const posts = await this.posts.findAll();
    return (
      <div>
        {posts.map((post) => (
          <article key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.excerpt}</p>
          </article>
        ))}
      </div>
    );
  }
}

// post/post.module.ts
@Module({
  imports: [DatabaseModule], // Need database access
  declarations: [PostList],
  providers: [PostService],
  exports: [PostService, PostList], // Make available to other modules
})
export class PostModule {}
```

### Comment Module

```typescript
// comment/comment.service.ts
@Injectable()
export class CommentService {
  constructor(private db: DatabaseService) {}

  async findByPostId(postId: number): Promise<Comment[]> {
    return this.db.comments.findMany({ where: { postId } });
  }
}

// comment/components/comment-list.component.tsx
@Component()
export class CommentList {
  constructor(private comments: CommentService) {}

  props!: { postId: number };

  async build() {
    const comments = await this.comments.findByPostId(this.props.postId);
    return (
      <div>
        {comments.map((comment) => (
          <div key={comment.id}>
            <p>{comment.content}</p>
            <small>By {comment.author}</small>
          </div>
        ))}
      </div>
    );
  }
}

// comment/comment.module.ts
@Module({
  imports: [DatabaseModule],
  declarations: [CommentList],
  providers: [CommentService],
  exports: [CommentService, CommentList],
})
export class CommentModule {}
```

### App Module (Root)

```typescript
// app.module.ts
@Module({
  imports: [DatabaseModule, PostModule, CommentModule],
  declarations: [AppComponent],
  providers: [AppService],
})
export class AppModule {}

// app.component.tsx
@Component({
  inject: [PostList, CommentList], // Can use exported components
})
export class AppComponent {
  constructor(private posts: PostService) {} // Can inject exported service

  async build() {
    return (
      <div>
        <h1>My Blog</h1>
        <PostList />
      </div>
    );
  }
}
```

**What's happening here:**

- `PostModule` and `CommentModule` are self-contained feature modules
- They both import `DatabaseModule` to access the database
- They export their services and components for other modules to use
- `AppModule` imports both feature modules and gets access to their exports
- `AppComponent` can use `PostList` and inject `PostService` because they're exported

---

## Module Scope and Encapsulation

Modules create boundaries. What's inside a module stays inside unless explicitly exported.

```typescript
@Module({
  providers: [PublicService, PrivateService],
  exports: [PublicService], // Only this is accessible
})
export class FeatureModule {}
```

Other modules importing `FeatureModule` can inject `PublicService` but not `PrivateService`. This lets you hide implementation details and expose only the public API.

### Why This Matters

**Encapsulation prevents coupling:**

```typescript
// ❌ Without modules, everything is global
// Any file can import any service from anywhere
// Hard to track what depends on what

// ✅ With modules, dependencies are explicit
@Module({
  imports: [FeatureModule], // Clear: we depend on FeatureModule
  providers: [MyService],
})
export class MyModule {}
```

**Refactoring becomes safer:**

If you change `PrivateService`, you only need to check within `FeatureModule`. If you change `PublicService`, you need to check all modules that import `FeatureModule`.

**Testing becomes easier:**

You can test a module in isolation by mocking its imports. No need to set up the entire application.

---

## Dynamic Modules

Sometimes you need to configure a module at runtime. Maybe you're building a reusable library module that needs configuration from the consuming application.

That's where dynamic modules come in.

### The Problem

Imagine you're building a `ConfigModule` that reads configuration from environment variables. Different applications might need different configurations:

```typescript
// App A needs these variables
const appAConfig = { apiUrl: "https://api-a.com", timeout: 5000 };

// App B needs different ones
const appBConfig = { apiUrl: "https://api-b.com", timeout: 10000 };
```

You can't hardcode these values in the module. You need to pass them in when the module is registered.

### The Solution: Dynamic Modules

A dynamic module is a module that returns its configuration programmatically:

```typescript
import { Module, DynamicModule, Injectable } from "@kithinji/orca";

export class ConfigModule {
  static forRoot(config: { apiUrl: string; timeout: number }): DynamicModule {
    @Injectable()
    class ConfigService {
      constructor() {
        console.log("ConfigService initialized with:", config);
      }

      get apiUrl() {
        return config.apiUrl;
      }

      get timeout() {
        return config.timeout;
      }
    }

    return {
      module: ConfigModule,
      providers: [ConfigService],
      exports: [ConfigService],
    };
  }
}
```

Now you can configure the module when importing it:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      apiUrl: process.env.API_URL || "https://api.example.com",
      timeout: 5000,
    }),
  ],
})
export class AppModule {}
```

**What's happening:**

1. `ConfigModule.forRoot()` is called with configuration
2. It creates a `ConfigService` class that closes over the config
3. It returns a `DynamicModule` object that tells Orca what to register
4. Orca registers the providers and makes them available for injection

### Real-World Dynamic Module

Here's a more realistic example; a database module:

```typescript
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export class DatabaseModule {
  static forRoot(config: DatabaseConfig): DynamicModule {
    @Injectable()
    class DatabaseService {
      private connection: Connection;

      constructor() {
        this.connection = new Connection({
          host: config.host,
          port: config.port,
          database: config.database,
          user: config.username,
          password: config.password,
        });
      }

      async query(sql: string, params: any[]) {
        return this.connection.query(sql, params);
      }

      async close() {
        return this.connection.end();
      }
    }

    return {
      module: DatabaseModule,
      providers: [DatabaseService],
      exports: [DatabaseService],
    };
  }
}
```

Usage:

```typescript
@Module({
  imports: [
    DatabaseModule.forRoot({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      database: process.env.DB_NAME || "myapp",
      username: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "",
    }),
  ],
})
export class AppModule {}
```

---

## Module Best Practices

### 1. One Module Per Feature

Organize modules around features, not technical layers:

```typescript
// ❌ Don't organize by technical layer
@Module({ ... })
export class ServicesModule {}  // All services

@Module({ ... })
export class ComponentsModule {}  // All components

// ✅ Organize by feature domain
@Module({ ... })
export class UserModule {}  // User-related services and components

@Module({ ... })
export class PostModule {}  // Post-related services and components
```

### 2. Keep Module Exports Minimal

Only export what other modules actually need:

```typescript
@Module({
  declarations: [PublicComponent, InternalComponent1, InternalComponent2],
  providers: [PublicService, InternalService1, InternalService2],
  exports: [
    PublicComponent, // Only what others need
    PublicService,
  ],
})
export class FeatureModule {}
```

Less exports = less coupling = easier refactoring.

### 3. Use Barrel Exports

Create an `index.ts` in each module directory:

```typescript
// user/index.ts
export { UserModule } from "./user.module";
export { UserService } from "./user.service";
export { UserProfile } from "./components/user-profile.component";
```

Then import from the module directory:

```typescript
// ✅ Clean imports
import { UserModule, UserService } from "./user";

// ❌ Messy imports
import { UserModule } from "./user/user.module";
import { UserService } from "./user/user.service";
```

### 4. Shared Modules for Common Code

Create a `SharedModule` for things used across multiple features:

```typescript
@Module({
  declarations: [ButtonComponent, CardComponent, LoaderComponent],
  providers: [LoggerService, UtilityService],
  exports: [
    // Export everything - it's meant to be shared
    ButtonComponent,
    CardComponent,
    LoaderComponent,
    LoggerService,
    UtilityService,
  ],
})
export class SharedModule {}
```

Import `SharedModule` wherever you need these common utilities.

---

## Module Dependency Graph

Modules form a directed acyclic graph (DAG). You can import other modules, but circular dependencies are not allowed:

```typescript
// ❌ Circular dependency - not allowed
@Module({ imports: [ModuleB] })
export class ModuleA {}

@Module({ imports: [ModuleA] })
export class ModuleB {}
```

If you need shared functionality between modules, extract it into a third module:

```typescript
// ✅ Shared functionality in separate module
@Module({ exports: [SharedService] })
export class SharedModule {}

@Module({ imports: [SharedModule] })
export class ModuleA {}

@Module({ imports: [SharedModule] })
export class ModuleB {}
```

Orca validates the dependency graph at startup and will throw an error if it detects cycles.

---

## When to Create a New Module

Create a new module when:

- **You have a distinct feature domain** (users, posts, payments, etc.)
- **Code can be reused** across projects (a UI component library, an API client)
- **You want to enforce boundaries** between parts of your application
- **A part of your app grows large** and needs better organization

Don't create modules just for the sake of it. A small application might have just `AppModule` and `SharedModule`. That's fine. Add modules as complexity grows.

---

Think of modules as **packages within your application**.

Each module is a self-contained unit with:

- Its own providers and components
- Declared dependencies on other modules
- A public API (exports)
- Private implementation details

Modules help you:

- **Organize** code by feature domain
- **Encapsulate** implementation details
- **Reuse** functionality across projects
- **Test** in isolation
- **Understand** dependencies at a glance

They're not just folders; they're architectural boundaries that the framework understands and enforces.

---

Modules are how Orca scales.

Start simple with an `AppModule`. As your application grows, extract features into their own modules. Use dynamic modules when you need runtime configuration. Keep exports minimal to reduce coupling.

Modules aren't about ceremony; they're about maintaining sanity as your codebase grows.

- **Clear boundaries** between features
- **Explicit dependencies** instead of implicit coupling
- **Reusable units** you can share across projects
- **Testable isolation** without setting up the world

This is the architecture that powers applications that last years, not months.

And unlike "light" frameworks that leave you to figure it out yourself, Orca gives you the structure from day one.
