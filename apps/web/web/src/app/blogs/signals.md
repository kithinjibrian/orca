# Signals: Fine-Grained Reactivity in Orca

Signals are Orca's answer to reactive state management.

A signal is a value that knows when it's been read and can notify dependents when it changes. That simplicity unlocks automatic, fine-grained UI updates without manual coordination.

---

## The Basics

### Creating a Signal

```tsx
import { signal } from "@kithinji/orca";

const count = signal(0);
```

That's a signal. It holds a value `(0)`, and you can read or write to it.

### Reading a Signal

Access the value through the `.value` property:

```tsx
const count = signal(0);
console.log(count.value);  // 0
```

### Writing a Signal

Update the value by assigning to `.value`:

```tsx
const count = signal(0);
count.value++;            // Now it's 1
count.value = 10;         // Now it's 10
```

Simple. Familiar. It looks like a normal variable, but it's reactive.

---

## Signals in Components

Here's where signals shine. They make components reactive automatically.

```tsx
import { Component, signal } from "@kithinji/orca";

@Component()
export class Counter {
  count = signal(0);
  
  build() {
    return (
      <div>
        <div>count: {this.count.value}</div>
        <button onClick={() => this.count.value++}>
          increment
        </button>
      </div>
    );
  }
}
```

When you click the button, `this.count.value++` updates the signal. The framework detects the change and updates only the specific part of the DOM that reads `this.count.value`. The button and surrounding elements don't re-render. Just the text showing the count.

This is fine-grained reactivity. The framework tracks which parts of your UI depend on which signals and updates only what's necessary.

### How It Works Under the Hood

When you access `this.count.value` in your JSX, Orca tracks the read and records that this part of the UI depends on `count`. It sets up a listener for when `count` changes. When `count.value` is set, only the subscribed parts re-render.

You don't see any of this. It just works.

---

## Passing Signals as Props

Signals maintain their reactivity even when passed as props.

```tsx
import { Component, signal } from "@kithinji/orca";

@Component()
export class Display {
  props!: {
    num: number;
  };
  
  build() {
    return <div>num: {this.props.num}</div>;
  }
}

@Component()
export class Counter {
  count = signal(0);
  
  build() {
    return (
      <div>
        {/* The prop is reactive. Display updates when count changes */}
        <Display num={this.count.value} />
        <button onClick={() => this.count.value++}>
          increment
        </button>
      </div>
    );
  }
}
```

`Counter` passes `this.count.value` as a prop. Even though `Display` receives it as a normal prop, the framework tracks the dependency. When `count` changes, `Display` automatically re-renders with the new value.

You don't need to pass the signal itself or use special props. The reactivity propagates naturally.

### Why This Matters

You can write components that are completely unaware of signals:

```tsx
@Component()
export class UserCard {
  props!: {
    name: string;
    age: number;
  };
  
  build() {
    return (
      <div>
        <h2>{this.props.name}</h2>
        <p>Age: {this.props.age}</p>
      </div>
    );
  }
}
```

This component doesn't know about signals. It just takes props. But you can pass signal values to it, and it will react to changes:

```tsx
@Component()
export class App {
  userName = signal("Alice");
  userAge = signal(25);
  
  build() {
    return (
      <div>
        <UserCard 
          name={this.userName.value} 
          age={this.userAge.value} 
        />
        <button onClick={() => this.userAge.value++}>
          Birthday!
        </button>
      </div>
    );
  }
}
```

Click the button, and `UserCard` updates even though it has no idea it's consuming reactive state.

This is the power of fine-grained reactivity. It's invisible to components that don't need to know about it.

---

## Computed Signals

Sometimes you need a value that's derived from other signals. That's what computed signals are for.

```tsx
import { Component, signal, computed } from "@kithinji/orca";

@Component()
export class ShoppingCart {
  quantity = signal(1);
  pricePerUnit = signal(29.99);
  
  // Computed signal automatically recalculates when dependencies change
  total = computed(() => this.quantity.value * this.pricePerUnit.value);
  
  build() {
    return (
      <div>
        <p>Quantity: {this.quantity.value}</p>
        <p>Price per unit: ${this.pricePerUnit.value}</p>
        <p>Total: ${this.total.value}</p>
        
        <button onClick={() => this.quantity.value++}>
          Add One
        </button>
        <button onClick={() => this.pricePerUnit.value += 5}>
          Increase Price
        </button>
      </div>
    );
  }
}
```

`computed(() => ...)` takes a function that reads signals. The framework tracks which signals the function reads (`quantity` and `pricePerUnit`). When any of those signals change, the computed value automatically recalculates. The computed value is also a signal, so you read it with `.value`.

### Lazy Evaluation

Computed signals are lazy. They only recalculate when accessed:

```tsx
const count = signal(0);
const doubled = computed(() => {
  console.log("Computing doubled");
  return count.value * 2;
});

// Nothing logged yet. Computed hasn't been evaluated.

console.log(doubled.value);  // Logs: "Computing doubled", then 2

count.value = 5;
// Still nothing logged. Computed is marked dirty but not recalculated.

console.log(doubled.value);  // Logs: "Computing doubled", then 10
```

This is efficient. Computed values only do work when they're actually needed.

### Chaining Computed Signals

Computed signals can depend on other computed signals:

```tsx
@Component()
export class PriceCalculator {
  quantity = signal(3);
  basePrice = signal(10);
  taxRate = signal(0.08);
  
  subtotal = computed(() => this.quantity.value * this.basePrice.value);
  tax = computed(() => this.subtotal.value * this.taxRate.value);
  total = computed(() => this.subtotal.value + this.tax.value);
  
  build() {
    return (
      <div>
        <p>Quantity: {this.quantity.value}</p>
        <p>Base Price: ${this.basePrice.value}</p>
        <p>Subtotal: ${this.subtotal.value}</p>
        <p>Tax: ${this.tax.value}</p>
        <p>Total: ${this.total.value}</p>
      </div>
    );
  }
}
```

Change `quantity`, and all three computed signals recalculate automatically. The dependency graph is tracked for you.

---

## Effects

Effects let you run side effects when signals change.

```tsx
import { Component, signal, effect } from "@kithinji/orca";

@Component()
export class Logger {
  count = signal(0);
  
  constructor() {
    // Run a side effect whenever count changes
    effect(() => {
      console.log(`Count is now: ${this.count.value}`);
    });
  }
  
  build() {
    return (
      <button onClick={() => this.count.value++}>
        Increment (check console)
      </button>
    );
  }
}
```

The effect runs immediately when created. The framework tracks that it reads `count.value`. Whenever `count` changes, the effect runs again.

### Effects vs Computed

Computed signals are for deriving values:

```tsx
const doubled = computed(() => count.value * 2);
```

Effects are for side effects:

```tsx
effect(() => {
  console.log(count.value);
  localStorage.setItem("count", String(count.value));
  document.title = `Count: ${count.value}`;
});
```

Use computed for values you'll read in your UI. Use effects for things like logging, storage, analytics, or updating external state.

### Cleanup in Effects

Effects can return a cleanup function that runs before the next effect or when the component is destroyed:

```tsx
effect(() => {
  const interval = setInterval(() => {
    console.log(`Count: ${this.count.value}`);
  }, 1000);
  
  // Cleanup function runs when effect re-runs or component unmounts
  return () => clearInterval(interval);
});
```

This prevents memory leaks and ensures side effects are properly cleaned up.

---

## Practical Examples

### Form Validation

```tsx
import { Component, signal, computed } from "@kithinji/orca";

@Component()
export class SignupForm {
  email = signal("");
  password = signal("");
  
  emailValid = computed(() => {
    const email = this.email.value;
    return email.includes("@") && email.includes(".");
  });
  
  passwordValid = computed(() => {
    return this.password.value.length >= 8;
  });
  
  formValid = computed(() => {
    return this.emailValid.value && this.passwordValid.value;
  });
  
  build() {
    return (
      <form>
        <div>
          <input
            type="email"
            value={this.email.value}
            onChange={(e) => this.email.value = e.target.value}
            placeholder="Email"
          />
          {!this.emailValid.value && this.email.value && (
            <span style={{ color: "red" }}>Invalid email</span>
          )}
        </div>
        
        <div>
          <input
            type="password"
            value={this.password.value}
            onChange={(e) => this.password.value = e.target.value}
            placeholder="Password"
          />
          {!this.passwordValid.value && this.password.value && (
            <span style={{ color: "red" }}>
              Password must be at least 8 characters
            </span>
          )}
        </div>
        
        <button 
          type="submit" 
          disabled={!this.formValid.value}
        >
          Sign Up
        </button>
      </form>
    );
  }
}
```

All validation is reactive. Change the email, and `emailValid`, `formValid`, and the UI update automatically.

### Todo List

```tsx
import { Component, signal, computed } from "@kithinji/orca";

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

@Component()
export class TodoList {
  todos = signal<Todo[]>([]);
  filter = signal<"all" | "active" | "done">("all");
  newTodoText = signal("");
  
  filteredTodos = computed(() => {
    const todos = this.todos.value;
    const filter = this.filter.value;
    
    if (filter === "active") return todos.filter(t => !t.done);
    if (filter === "done") return todos.filter(t => t.done);
    return todos;
  });
  
  activeCount = computed(() => {
    return this.todos.value.filter(t => !t.done).length;
  });
  
  addTodo() {
    if (!this.newTodoText.value.trim()) return;
    
    const newTodo: Todo = {
      id: Date.now(),
      text: this.newTodoText.value,
      done: false
    };
    
    this.todos.value = [...this.todos.value, newTodo];
    this.newTodoText.value = "";
  }
  
  toggleTodo(id: number) {
    this.todos.value = this.todos.value.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    );
  }
  
  build() {
    return (
      <div>
        <input
          value={this.newTodoText.value}
          onChange={(e) => this.newTodoText.value = e.target.value}
          onKeyPress={(e) => e.key === "Enter" && this.addTodo()}
          placeholder="What needs to be done?"
        />
        
        <div>
          <button onClick={() => this.filter.value = "all"}>All</button>
          <button onClick={() => this.filter.value = "active"}>Active</button>
          <button onClick={() => this.filter.value = "done"}>Done</button>
        </div>
        
        <ul>
          {this.filteredTodos.value.map(todo => (
            <li 
              key={todo.id}
              style={{ textDecoration: todo.done ? "line-through" : "none" }}
              onClick={() => this.toggleTodo(todo.id)}
            >
              {todo.text}
            </li>
          ))}
        </ul>
        
        <p>{this.activeCount.value} items left</p>
      </div>
    );
  }
}
```

### Auto-Save with Effects

```tsx
import { Component, signal, effect } from "@kithinji/orca";

@Component()
export class NoteEditor {
  content = signal("");
  lastSaved = signal<Date | null>(null);
  
  constructor() {
    // Auto-save to localStorage
    effect(() => {
      localStorage.setItem("draft", this.content.value);
    });
    
    // Debounced save to server
    effect(() => {
      const content = this.content.value;
      
      const timeoutId = setTimeout(() => {
        this.saveToServer(content);
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    });
  }
  
  async saveToServer(content: string) {
    await fetch("/api/notes", {
      method: "POST",
      body: JSON.stringify({ content })
    });
    this.lastSaved.value = new Date();
  }
  
  build() {
    return (
      <div>
        <textarea
          value={this.content.value}
          onChange={(e) => this.content.value = e.target.value}
          rows={10}
          cols={50}
        />
        {this.lastSaved.value && (
          <p>Last saved: {this.lastSaved.value.toLocaleTimeString()}</p>
        )}
      </div>
    );
  }
}
```

---

## Signal Patterns and Best Practices

### 1. Keep Signals Local

Signals work best when they're close to where they're used:

```tsx
// ✅ Good: signal is part of the component
@Component()
export class Counter {
  count = signal(0);
  
  build() {
    return <div>{this.count.value}</div>;
  }
}

// ❌ Avoid: global signals are harder to reason about
const globalCount = signal(0);

@Component()
export class Counter {
  build() {
    return <div>{globalCount.value}</div>;
  }
}
```

### 2. Use Computed for Derived State

Don't manually update derived state. Use computed:

```tsx
// ❌ Don't do this
@Component()
export class PriceDisplay {
  quantity = signal(1);
  price = signal(10);
  total = signal(10);
  
  updateQuantity(newQuantity: number) {
    this.quantity.value = newQuantity;
    this.total.value = newQuantity * this.price.value;  // Manual sync
  }
}

// ✅ Do this
@Component()
export class PriceDisplay {
  quantity = signal(1);
  price = signal(10);
  total = computed(() => this.quantity.value * this.price.value);  // Auto sync
}
```

### 3. Batch Updates

When updating multiple signals, consider batching to avoid intermediate renders:

```tsx
import { batch } from "@kithinji/orca";

@Component()
export class Form {
  firstName = signal("");
  lastName = signal("");
  fullName = computed(() => 
    `${this.firstName.value} ${this.lastName.value}`
  );
  
  reset() {
    // Without batch, this triggers 2 updates
    this.firstName.value = "";
    this.lastName.value = "";
    
    // With batch, this triggers 1 update
    batch(() => {
      this.firstName.value = "";
      this.lastName.value = "";
    });
  }
}
```

### 4. Don't Overuse Effects

Effects are for side effects, not for deriving state:

```tsx
// ❌ Don't use effects for derived state
const count = signal(0);
const doubled = signal(0);

effect(() => {
  doubled.value = count.value * 2;  // Bad: use computed instead
});

// ✅ Use computed for derived state
const count = signal(0);
const doubled = computed(() => count.value * 2);
```

### 5. Cleanup Effects Properly

Always clean up effects that create subscriptions or timers:

```tsx
effect(() => {
  const subscription = someObservable.subscribe(/* ... */);
  const intervalId = setInterval(/* ... */);
  
  return () => {
    subscription.unsubscribe();
    clearInterval(intervalId);
  };
});
```

---
## Performance Characteristics

### Fine-Grained Updates

The biggest performance win: only what changes re-renders.

```tsx
@Component()
export class Dashboard {
  userCount = signal(100);
  postCount = signal(500);
  commentCount = signal(1000);
  
  build() {
    return (
      <div>
        <StatCard title="Users" count={this.userCount.value} />
        <StatCard title="Posts" count={this.postCount.value} />
        <StatCard title="Comments" count={this.commentCount.value} />
      </div>
    );
  }
}
```

When `userCount` changes, only the first `StatCard` re-renders. The other two don't even check if they need to update.

### Computed Memoization

Computed signals automatically memoize their values:

```tsx
const expensiveComputation = computed(() => {
  // This only runs when dependencies change
  return somethingExpensive(input.value);
});

// Reading the value multiple times doesn't recompute
const result1 = expensiveComputation.value;
const result2 = expensiveComputation.value;  // Returns cached value
```

No need for manual memoization like `useMemo`.

---

## The Bottom Line

Signals give you reactive state that just works.

Simple API. `.value` for reading and writing.

Automatic updates. Change a signal, the UI updates.

Fine-grained. Only what depends on the signal re-renders.

Composable. Computed signals derive from other signals.

Side effects. Effects run when signals change.

No hooks. No rules. No dependency arrays. No manual optimization.

Just declare your state, derive what you need, and let the framework handle the rest.

That's the power of signals. Reactivity that gets out of your way and lets you focus on building features.