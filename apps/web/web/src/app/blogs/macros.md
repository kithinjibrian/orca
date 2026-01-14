# Macros: Compile-Time Magic in Orca

Orca has macros that run at build time. Can you imagine that?

And here we thought that arcane magic was only limited to languages like Rust.

But here we are, writing TypeScript that transforms itself during compilation. Code that runs before your code runs. Meta-programming without the usual JavaScript limitations.

**Macros let you execute code at build time and inline the results directly into your application.**

---

## Why Macros?

Some things are better done at build time than runtime:

- **Reading configuration files**: Why parse JSON on every request when you can do it once at build time?
- **Inlining assets**: Embed small files directly in your bundle instead of making HTTP requests
- **Code generation**: Generate boilerplate based on your source code structure
- **Environment variables**: Resolve environment-specific values at compile time
- **CSS processing**: Transform styles and generate optimized class names

Macros let you do this without complex build plugins or code generators. Just write TypeScript functions that return TypeScript AST nodes, and the build tool handles the rest.

---

## Creating a Macro

Macros are TypeScript functions with a special naming convention: they must end with `$`.

### Best Practice: Separate Files

Create macros in their own files for clarity:

```ts
// env.macro.ts
import { MacroContext } from "@kithinji/pod";
import ts from "typescript";

export function env$(key: string, context?: MacroContext): string {
  if (!context) throw new Error("Context is undefined");

  const realKey = key as unknown as ts.Node;
  const valueKey = context.resolveNodeValue(realKey);

  const envValue = process.env[valueKey] || `MISSING_${valueKey}`;

  return context.factory.createStringLiteral(envValue) as any;
}
```

**How it works:**

1. The function name ends with `$` to signal Orca that it is a macro
2. It can take a `MacroContext` parameter
3. It works with TypeScript AST nodes
4. Transformation happens at build time

⚠️ A macro like `env$` will hardcode your API keys into code. Do not push distribution files with secrets to GitHub.

### The Duck-Typing Trick

```ts
export function env$(key: string, context?: MacroContext): string;
```

We declare `key` as a `string` and return `string`, but internally we work with AST nodes. This lets TypeScript provide autocomplete and type checking while allowing macros to manipulate ASTs.

---

## Using Macros

Use a macro like a normal function:

```tsx
import { Component } from "@kithinji/orca";
import { env$ } from "./env.macro";

@Component()
export class HelloWorld {
  build() {
    const apiKey = env$("API_KEY");
    return <div>API Key: {apiKey}</div>;
  }
}
```

**At build time, this transforms into:**

```tsx
@Component()
export class HelloWorld {
  build() {
    const apiKey = "sk_live_abc123def456";
    return <div>API Key: {apiKey}</div>;
  }
}
```

The macro call is replaced with its result. No runtime overhead. The value is baked into your code.

---

## The MacroContext

The `MacroContext` object is your interface to the build system. It provides:

### resolveNodeValue()

Extracts the value from an AST node:

```ts
const realKey = key as unknown as ts.Node;
const valueKey = context.resolveNodeValue(realKey);
// valueKey is "API_KEY"
```

### factory

Create TypeScript AST nodes:

```ts
context.factory.createStringLiteral("hello");
context.factory.createNumericLiteral(42);
context.factory.createObjectLiteralExpression([
  context.factory.createPropertyAssignment(
    "name",
    context.factory.createStringLiteral("Alice")
  )
]);
```

Other utilities include:

- Reading files from the filesystem
- Resolving module paths
- Accessing TypeScript's type checker
- Analyzing project structure

---

## Built-in Macros

Orca provides built-in macros through `@kithinji/arcane`.

### 1. inlineFile$ and inlineFiles$

Read files at build time:

```ts
import { inlineFile$, inlineFiles$ } from "@kithinji/arcane";

const readme = inlineFile$("README.md");
const docs = inlineFiles$(["intro.md", "guide.md"]);
```

**Why:** No filesystem access at runtime, no deployment concerns, contents embedded directly in your bundle.

### 2. style$ and apply$

Generate CSS and apply it:

```tsx
import { style$, apply$ } from "@kithinji/arcane";

const cls = style$({
  h1: { padding: "1rem", fontSize: "2rem", color: "#333" },
  p: { lineHeight: 1.6, marginBottom: "1rem" },
});

<Component>
  <h1 {...apply$(cls.h1)}>My Article</h1>
  <p {...apply$(cls.p)}>Content goes here</p>
</Component>
```

`style$` generates optimized class names. `apply$` applies them to elements. CSS is extracted and bundled separately.

---

## More Macro Examples

### Config Loader

```ts
export function loadConfig$(path: string, context?: MacroContext): any {
  const filePath = context!.resolveNodeValue(path as any);
  const config = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return context!.factory.createObjectLiteralExpression(
    Object.entries(config).map(([k, v]) =>
      context!.factory.createPropertyAssignment(k, context!.factory.createStringLiteral(String(v)))
    )
  ) as any;
}
```

### Feature Flag

```ts
export function isFeatureEnabled$(flag: string, context?: MacroContext): boolean {
  const flagName = context!.resolveNodeValue(flag as any);
  const enabled = process.env[`FEATURE_${flagName}`] === "true";
  return enabled ? context!.factory.createTrue() : context!.factory.createFalse();
}
```

### Build-Time Timestamp

```ts
export function buildTime$(context?: MacroContext): string {
  return context!.factory.createStringLiteral(new Date().toISOString()) as any;
}
```

---

## Macro Best Practices

1. **Use descriptive names**: Keep `$` suffix meaningful.
2. **Handle errors clearly**: Make errors explicit at build time.
3. **Document inputs**: Clarify what values macros expect.
4. **Keep macros pure**: Same input should always produce same output.
5. **Use macros thoughtfully**: Avoid using them for runtime logic.

---

## The Power and Responsibility

Macros give compile-time metaprogramming in TypeScript.

You can:

- Inline files
- Transform code based on environment
- Generate boilerplate
- Optimize away code branches

But use them carefully:

- Build times increase
- Caching is tricky
- Debugging is harder

---

## What's Next

Next chapter: `style$` and `apply$` for CSS at build time:

- Scoped styles and CSS modules
- Type-safe style objects
- Media queries and pseudo-selectors
- Integration with CSS frameworks
- Performance optimizations

You now know:

- Macros run at build time
- They transform TypeScript AST nodes
- Function names must end with `$`
- Built-in macros solve common problems
- You can write your own for project-specific needs

Macros are Orca's tool for compile-time optimization. They let you write code that writes code, inline configuration, and generate optimized CSS, all in TypeScript.