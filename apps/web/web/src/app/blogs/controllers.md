# Controllers: Your API Layer in Orca

Controllers in Orca are the entry point for HTTP requests. They form the boundary between the outside world and your application logic.

If you have used Express, Fastify, or NestJS, the concept will feel familiar. Orca adds one important twist: **automatic controller generation for public services.**

---

## What Is a Controller?

A controller is a class responsible for handling HTTP requests. Each method corresponds to an endpoint.

Here is a simple example:

```ts
import { Controller, Get, Post, Body, Param } from "@kithinji/orca";

@Controller("/users")
export class UserController {
  constructor(private userService: UserService) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Get("/:id")
  async findOne(@Param("id") id: number) {
    return this.userService.findById(id);
  }

  @Post()
  async create(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }
}
```

**What this does:**

- `@Controller("/users")` defines the base route
- `@Get()` maps to `GET /users`
- `@Get("/:id")` maps to `GET /users/:id`
- `@Post()` maps to `POST /users`
- Decorators extract parameters and request bodies

The result is clean, declarative, and type-safe.

---

## Available Decorators

### Route Decorators

These map methods to HTTP routes:

```ts
@Get("/path")
@Post("/path")
@Put("/path")
@Patch("/path")
@Delete("/path")
@Options("/path")
@Head("/path")
```

### Parameter Decorators

These extract data from the request:

```ts
@Param("id")
@Query("page")
@Body()
@Body("email")
@Headers("authorization")
@Req()
@Res()
```

### Example with Multiple Decorators

```ts
@Controller("/posts")
export class PostController {
  constructor(private posts: PostService) {}

  @Get()
  async search(
    @Query("term") term: string,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 10
  ) {
    return this.posts.search(term, page, limit);
  }

  @Put("/:id")
  async update(
    @Param("id") id: number,
    @Body() data: UpdatePostDto,
    @Headers("authorization") token: string
  ) {
    return this.posts.update(id, data);
  }
}
```

---

## Response Handling

### Automatic Serialization

Anything you return is automatically serialized to JSON:

```ts
@Get("/:id")
async getUser(@Param("id") id: number) {
  return { id, name: "John", email: "john@example.com" };
}
```

### Custom Status Codes

Use `@HttpCode()` to override the default:

```ts
@Post()
@HttpCode(201)
async create(@Body() data: CreateUserDto) {
  return this.userService.create(data);
}
```

### Manual Response Control

For full control, inject the response object:

```ts
@Get("/download")
async download(@Res() res: Response) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=report.pdf"
  );
  res.send(fileBuffer);
}
```

---

## Validation with Schemas

Orca encourages runtime validation using schemas such as Zod:

```ts
import { z } from "zod";

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  age: z.number().min(18),
});

type CreateUserDto = z.infer<typeof CreateUserSchema>;

@Controller("/users")
export class UserController {
  @Post()
  async create(@Body() data: unknown) {
    const validated = CreateUserSchema.parse(data);
    return this.userService.create(validated);
  }
}
```

This ensures invalid data never reaches your business logic.

---

## Error Handling

Orca provides standard HTTP exceptions:

```ts
import {
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from "@kithinji/orca";

@Controller("/users")
export class UserController {
  @Get("/:id")
  async findOne(@Param("id") id: number) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  @Delete("/:id")
  async delete(
    @Param("id") id: number,
    @Headers("authorization") token: string
  ) {
    if (!token) {
      throw new UnauthorizedException("Token required");
    }

    const user = await this.verifyToken(token);
    if (user.role !== "admin") {
      throw new ForbiddenException("Admins only");
    }

    await this.userService.delete(id);
    return { success: true };
  }
}
```

Exceptions are automatically converted into proper HTTP responses.

---

## Automatic Controllers for Public Services

This is where Orca stands out.

When you mark a service with `"use public"`, Orca automatically generates a controller for it at build time.

You do not write the controller. Orca does.

---

## How It Works

Given a public service:

```ts
"use public";
import { Injectable, Signature } from "@kithinji/orca";
import { z } from "zod";

const GetProductSchema = z.object({
  id: z.number(),
});

const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number(),
});

@Injectable()
export class ProductService {
  @Signature(GetProductSchema, ProductSchema)
  public async getProduct(id: number) {
    return { id, name: "Widget", price: 29.99 };
  }

  public async listProducts() {
    return [];
  }
}
```

Orca generates a controller similar to:

```ts
@Controller("/ProductService")
export class ProductAutoController {
  constructor(private productService: ProductService) {}

  @Post("getProduct")
  async getProduct(@Body() body: unknown) {
    const validated = GetProductSchema.parse(body);
    const result = await this.productService.getProduct(validated.id);
    return ProductSchema.parse(result);
  }

  @Get("listProducts")
  async listProducts() {
    return this.productService.listProducts();
  }
}
```

**What happens automatically:**

- Routes are generated
- Inputs are validated
- Outputs are validated
- Service methods are called directly

---

## Client-Side Integration

The same service is stubbed on the client:

```ts
@Injectable()
export class ProductService {
  async getProduct(id: number) {
    const res = await fetch("/ProductService/getProduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.json();
  }

  async listProducts() {
    const res = await fetch("/ProductService/listProducts");
    return res.json();
  }
}
```

No manual fetch calls. No duplicated types. No glue code.

---

## The Role of @Signature

`@Signature` enables runtime validation and tooling support:

```ts
@Signature(InputSchema, OutputSchema)
```

It:

1. Documents input and output shapes
2. Enables automatic validation
3. Rejects invalid requests early
4. Catches incorrect return values

Without it, auto-generated controllers simply pass data through. With it, your APIs become safe by default.

---

## Manual vs Auto Controllers

### Use Auto Controllers When

- Building internal APIs
- Sharing logic with your frontend
- Prioritizing type safety over HTTP semantics
- Minimizing boilerplate

### Write Controllers Manually When

- Designing public REST APIs
- Needing fine-grained HTTP control
- Custom headers or status codes matter
- One endpoint orchestrates multiple services

Both approaches work together in the same application.

---

## Best Practices

### Keep Controllers Thin

```ts
@Post()
async create(@Body() data: CreateUserDto) {
  return this.userService.create(data);
}
```

Controllers orchestrate. Services implement logic.

### Validate Early

```ts
const validated = Schema.parse(data);
```

Fail fast and fail safely.

### Handle Errors Consistently

Translate domain errors into HTTP errors at the boundary.

---

## Final Thoughts

Controllers in Orca give you flexibility without duplication:

- Write them manually when API design matters
- Generate them automatically when productivity matters

Either way, your business logic always lives in services. Controllers stay thin, predictable, and easy to reason about.

That separation is what keeps Orca applications clean, scalable, and maintainable as they grow.