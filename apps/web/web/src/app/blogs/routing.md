# Routing in Orca: Stack-Based Navigation

Orca takes a different approach to routing. Instead of organizing your app around a file structure that mirrors your URLs, Orca uses a navigation stack. This guide explains why and how.

---

## The Problem with File-Based Routing

Most modern frameworks use file-based routing: your folder structure becomes your URL structure. `pages/products/[id].tsx` becomes `/products/123`.

This creates problems:

**Your architecture becomes rigid.** Your app is organized by URLs, not by features. Everything related to "products" gets scattered across `pages/`, `components/`, and `api/` just to satisfy the routing convention.

**Refactoring breaks everything.** Move a file and you break every URL. Rename a folder and every import path needs updating.

**Sharing code gets messy.** Components reach across arbitrary folder boundaries that exist because of URL paths, not because of logical relationships.

**It prioritizes aesthetics over logic.** It's like organizing a library by book cover color instead of genre. It looks nice, but you can't find anything.

Orca chooses a different path.

---

## Stack-Based Navigation: The Core Concept

In Orca, navigation works like a stack of cards:

- You start with one card at the bottom (your home page)
- Push a new card on top when navigating forward
- Pop the top card off to go back
- The visible page is always whatever's on top

Think of how mobile apps work. When you tap into a detail view, the previous screen doesn't disappear. It's still there, waiting underneath. Tap back and it appears instantly with all its state intact.

That's how Orca navigation works on the web.

---

## The Navigate Service

Navigation in Orca is handled by the `Navigate` service. Inject it into any component and you control the entire navigation flow.

```tsx
import { Component, Navigate } from "@kithinji/orca";

@Component()
export class AppPage {
  constructor(private navigate: Navigate) {}

  build() {
    return (
      <div class="p-4">
        <h1>Welcome Home</h1>
        <button onClick={() => this.navigate.push(<UserPage id={1} />)}>
          View User Profile
        </button>
      </div>
    );
  }
}
```

### What happens here:

1. **Push**: `this.navigate.push(<UserPage id={1} />)` puts the UserPage component on top of the stack
2. **Render**: UserPage becomes the active view and renders immediately
3. **Preserve**: AppPage stays in the stack below, maintaining all its state

When the user navigates back, AppPage reappears exactly as they left it.

---

## Navigation Methods

The Navigate service provides five core methods:

### `push(component)`

Adds a new page on top of the stack. The standard "navigate forward" action.

```tsx
this.navigate.push(<ProductDetail productId={123} />);
```

### `pop()`

Removes the current page and reveals the one underneath. Like the browser's back button, but you control exactly where users land.

```tsx
this.navigate.pop();
```

### `replace(component)`

Swaps the current page with a new one without changing stack depth. Perfect for redirects.

```tsx
// After login, replace the login page with the dashboard
// User can't "back" into the login screen
this.navigate.replace(<Dashboard />);
```

### `popToRoot()`

Clears the entire stack except for the first page. The "emergency exit" that takes users back to the beginning.

```tsx
this.navigate.popToRoot();
```

### `canPop()`

Returns true if there are pages below the current one. Useful for conditionally showing back buttons.

```tsx
build() {
  return (
    <div>
      {this.navigate.canPop() && (
        <button onClick={() => this.navigate.pop()}>
          Back
        </button>
      )}
    </div>
  );
}
```

---

## Passing Data Between Pages

Traditional routing forces you to encode data in URL strings. You spend time converting `"123"` back into the number `123`, dealing with URL encoding, and handling missing parameters.

Orca lets you pass data directly via props:

```tsx
this.navigate.push(
  <ProductDetail
    productId={123}
    isFeatured={true}
    tags={["electronics", "featured"]}
  />
);
```

**TypeScript enforces everything.** If ProductDetail expects a number and you pass a string, your IDE shows an error immediately. No more runtime crashes from undefined URL parameters.

### Returning Data with Callbacks

The stack model makes "returning" data elegant. Need the user to pick something and bring it back? Pass a callback.

```tsx
@Component()
export class OrderPage {
  constructor(private navigate: Navigate) {}

  private selectedUser: User | null = null;

  build() {
    return (
      <div>
        <h1>Create Order</h1>
        <button
          onClick={() => {
            this.navigate.push(
              <UserPicker
                onSelect={(user) => {
                  this.selectedUser = user;
                  this.navigate.pop();
                }}
              />
            );
          }}
        >
          Select Customer
        </button>

        {this.selectedUser && <div>Selected: {this.selectedUser.name}</div>}
      </div>
    );
  }
}
```

When the user picks someone, the callback fires, updates the state, and pops the picker off the stack automatically.

---

## Real Example: Multi-Step Forms

Traditional routing makes wizards painful. You end up with URLs like `/signup/step-1`, `/signup/step-2`, and you have to manage state across separate route handlers.

In Orca, a wizard is just a sequence of components:

```tsx
@Component()
export class SignupWizard {
  constructor(private navigate: Navigate) {}

  build() {
    return (
      <button
        onClick={() => {
          this.navigate.push(
            <StepOne
              onNext={(userData) => {
                this.navigate.push(
                  <StepTwo
                    userData={userData}
                    onNext={(preferences) => {
                      this.navigate.push(
                        <StepThree
                          userData={userData}
                          preferences={preferences}
                          onComplete={() => {
                            this.navigate.popToRoot();
                          }}
                        />
                      );
                    }}
                  />
                );
              }}
            />
          );
        }}
      >
        Start Signup
      </button>
    );
  }
}
```

Each step is self-contained. Data flows forward through props. When complete, pop back to the root.

---

## URLs and Bookmarking

You might be wondering: "If there's no file-based routing, how do users bookmark pages?"

Orca understands that URLs matter for user experience. The framework treats URLs as **aliases** for components, not the source of truth.

### Defining URL Routes

Use the `route` option in the `@Component` decorator:

```tsx
@Component({
  route: "/search/:id?q&location*",
})
export class SearchPage {
  props!: {
    id: string;
    q: string;
    location?: string;
  };

  build() {
    return (
      <div>
        <h1>Search Results</h1>
        <p>ID: {this.props.id}</p>
        <p>Query: {this.props.q}</p>
        {this.props.location && <p>Location: {this.props.location}</p>}
      </div>
    );
  }
}
```

### Route Syntax

- **`/search`**: The base path
- **`:id`**: Required path parameter (maps to `props.id`)
- **`?q`**: Required query parameter (maps to `props.q`)
- **`&location*`**: Optional query parameter (maps to `props.location`)

### How URLs Work

**Regular anchor tags work:**

```tsx
<a href="/search/42?q=laptops&location=nairobi">Search Laptops</a>
```

When clicked, Orca:

1. Intercepts the click
2. Finds the component registered to that route
3. Extracts parameters from the URL
4. Pushes the component onto the stack with those props

**Direct URL access works:**

If a user bookmarks `/search/42?q=laptops` and visits it directly, Orca:

1. Reads the URL
2. Finds SearchPage
3. Creates it with the extracted props
4. Pushes it onto the initial stack

**The URL reflects the stack:**

As users navigate, the URL updates to match the current top component. But the URL is a **reflection** of the navigation state, not the controller of it.

---

## Programmatic Navigation with Routes

You can still navigate using strings if you prefer:

```tsx
// These are equivalent:
this.navigate.push(<SearchPage id="42" q="laptops" />);

// Less type-safe, but works:
this.navigate.push("/search/42?q=laptops");
```

The component-based approach gives you full type safety. The string approach works like traditional routing if that's your preference.

---

## The Philosophy

**Traditional routing treats your app like a map.** You define roads (routes) and users travel between points. Move a road and the map breaks.

**Orca treats your app like a story.** You push components onto a stack and users move through a logical flow. The URL is a reflection of where they are, not the source of truth.

This mental model has benefits:

**Organize by feature, not by URL.** Put everything related to "products" in one folder, regardless of how many URLs it serves.

**Refactor fearlessly.** Move components around without worrying about breaking routes or imports.

**Type safety everywhere.** Pass real data structures, not serialized strings.

**Predictable state.** Components stay in the stack preserving their state. No mysterious "why did this reset?" moments.

**Easy testing.** Push components directly in tests without mocking routing systems.

---

## When to Use Each Approach

**Use stack navigation (push/pop) when:**

- Building interactive flows (wizards, pickers, detail views)
- You need to preserve state between screens
- You want type-safe data passing
- The navigation is part of your feature logic

**Use URL routes when:**

- Users need to bookmark or share specific pages
- You're building traditional web pages (about, contact, blog posts)
- SEO matters for the page
- You want users to open links in new tabs

**Use both together:**
Most apps use both. Define routes for major pages users might bookmark, then use stack navigation for the interactive flows within those pages.

---

## Comparison to Other Patterns

### vs. File-Based Routing (Next.js, SvelteKit)

**File-based:**

```
pages/
  products/
    [id].tsx
    index.tsx
  users/
    [id].tsx
```

Your folder structure is your routing table. Moving files breaks URLs.

**Orca:**

```
features/
  products/
    product-list.component.tsx
    product-detail.component.tsx
    product.service.ts
```

Organize by feature. Define routes where needed with `@Component({ route: "..." })`.

### vs. React Router / Vue Router

**Traditional routers:**

```tsx
<Route path="/products/:id" component={ProductDetail} />
```

Define all routes upfront in a central configuration. Data passes through URL params.

**Orca:**

```tsx
this.navigate.push(<ProductDetail productId={123} />);
```

Navigate by pushing components. Data passes through props. Define routes only for pages that need URLs.

---

## Migration Guide

If you're coming from file-based routing:

**1. Stop thinking in URLs**

Instead of "what URL should this be?", think "what component comes next in the user flow?"

**2. Use push/pop for navigation flows**

Anything that feels like drilling down into detail or opening a modal should use `push()`. Going back should use `pop()`.

**3. Add routes only where needed**

Only add `route: "/..."` to components that users need to bookmark or share. Not every component needs a route.

**4. Pass data through props**

Stop serializing objects into query strings. Just pass the actual objects.

**5. Use callbacks to return data**

Instead of navigating to a URL with a return value in the query string, pass a callback that fires when complete.

---

Orca's stack-based navigation separates your application architecture from your URL structure. Organize code by feature, navigate by pushing components, and define URLs only where they matter to users.

It might feel different at first. But once you stop worrying about folder structures and URL patterns, you can focus entirely on building features. Your code becomes more flexible, more type-safe, and easier to refactor.

The URL is just a reflection of your navigation state, not the master of it.
