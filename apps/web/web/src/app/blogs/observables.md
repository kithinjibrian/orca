# Observables: Reactive Streams in Orca

If signals are reactive values, observables are reactive streams.

Where a signal holds one value that changes over time, an observable represents multiple values that arrive over time. Think of them as arrays where the elements arrive asynchronously.

Observables are perfect for:

- User events (clicks, key presses, mouse movements)
- Async operations (API calls, timers, websockets)
- Streams of data (real-time updates, server-sent events)
- Complex async flows (debouncing, retrying, combining multiple sources)

---

## Creating Observables

### The Basic Constructor

The most fundamental way to create an observable:

```typescript
import { observable } from "@kithinji/orca";

const numbers = observable<number>((observer) => {
  observer.next(1);
  observer.next(2);
  observer.next(3);
  observer.complete();
});
```

You pass a function that receives an `observer`. Call `observer.next(value)` to emit values, `observer.complete()` when done, and `observer.error(err)` if something goes wrong. The function runs when someone subscribes.

### Timer Example

```typescript
import { observable } from "@kithinji/orca";

const ticks = observable<number>((observer) => {
  let count = 0;

  const intervalId = setInterval(() => {
    observer.next(count++);
  }, 1000);

  // Cleanup function runs when unsubscribed
  return () => clearInterval(intervalId);
});
```

Every second, this emits the next number. When someone unsubscribes, the cleanup function clears the interval.

---

## Subscribing to Observables

Observables are lazy. Nothing happens until you subscribe:

```typescript
const subscription = numbers.subscribe({
  next: (value) => console.log("Got:", value),
  error: (err) => console.error("Error:", err),
  complete: () => console.log("Done!"),
});

// Later, stop listening
subscription.unsubscribe();
```

You can also use a shorthand for just handling values:

```typescript
const subscription = numbers.subscribe((value) => {
  console.log("Got:", value);
});
```

Always unsubscribe when you're done to prevent memory leaks.

---

## Observables in Components

To use observables in components, convert them to signals using `toSignal()`:

```tsx
import { Component, observable, toSignal } from "@kithinji/orca";

@Component()
export class TickTock {
  ticks = observable<number>((observer) => {
    let count = 0;
    const intervalId = setInterval(() => {
      observer.next(count++);
    }, 1000);

    return () => clearInterval(intervalId);
  });

  build() {
    const value = toSignal(this.ticks, this);

    return <div>Ticks: {value}</div>;
  }
}
```

The `toSignal()` function subscribes to the observable and automatically updates a signal with the latest emitted value. The subscription is automatically cleaned up when the component is destroyed.

---

## Observables in Services

When observables are used in public services, they are converted to server-sent events on the server side and consumed using the EventSource API under the hood on the client side. Everything is abstracted for you.

Important: You must type annotate functions returning observables with `(): Observable<T>`, otherwise the build system will not properly desugar the code.

```typescript
"use public";

import { Injectable, observable, Observable } from "@kithinji/orca";

@Injectable()
export class TickTockService {
  // Type annotation is required: (): Observable<number>
  public ticktock(): Observable<number> {
    return observable<number>((observer) => {
      let count = 0;
      const intervalId = setInterval(() => {
        observer.next(count++);
      }, 1000);

      return () => clearInterval(intervalId);
    });
  }
}
```

```tsx
"use client";

import { Component, toSignal } from "@kithinji/orca";

@Component()
export class TickTock {
  constructor(private readonly ticktockService: TickTockService) {}

  build() {
    const stream = this.ticktockService.ticktock();
    const value = toSignal(stream, this);

    return <div>Ticks: {value}</div>;
  }
}
```

---

## Creating Observables from Common Sources

Orca provides helper functions for creating observables:

### from() - From Arrays

```typescript
import { from } from "@kithinji/orca";

const numbers = from([1, 2, 3, 4, 5]);

numbers.subscribe(console.log);
// Logs: 1, 2, 3, 4, 5
```

### of() - From Values

```typescript
import { of } from "@kithinji/orca";

const greeting = of("Hello", "World", "!");

greeting.subscribe(console.log);
// Logs: "Hello", "World", "!"
```

### interval() - Timer-Based

```typescript
import { interval } from "@kithinji/orca";

const timer = interval(1000); // Emit every 1000ms

timer.subscribe((count) => {
  console.log(`Tick ${count}`);
});
// Logs: Tick 0, Tick 1, Tick 2, ...
```

### fromEvent() - From DOM Events

```typescript
import { fromEvent } from "@kithinji/orca";

const button = document.querySelector("#myButton");
const clicks = fromEvent(button, "click");

clicks.subscribe((event) => {
  console.log("Button clicked!", event);
});
```

---

## Observable Operators

Observables become powerful when you transform them with operators:

### map() - Transform Values

```typescript
import { from, map } from "@kithinji/orca";

const numbers = from([1, 2, 3, 4, 5]);
const doubled = numbers.pipe(map((x) => x * 2));

doubled.subscribe(console.log);
// Logs: 2, 4, 6, 8, 10
```

### filter() - Select Values

```typescript
import { from, filter } from "@kithinji/orca";

const numbers = from([1, 2, 3, 4, 5]);
const evens = numbers.pipe(filter((x) => x % 2 === 0));

evens.subscribe(console.log);
// Logs: 2, 4
```

### debounceTime() - Wait Between Events

```typescript
import { fromEvent, debounceTime } from "@kithinji/orca";

const searchInput = fromEvent(input, "input");
const debouncedSearch = searchInput.pipe(
  debounceTime(300) // Wait 300ms after typing stops
);

debouncedSearch.subscribe((event) => {
  // Only fires 300ms after user stops typing
  performSearch(event.target.value);
});
```

### switchMap() - Switch to New Observable

```typescript
import { fromEvent, debounceTime, map, switchMap } from "@kithinji/orca";

const searchQuery = fromEvent(input, "input");
const results = searchQuery.pipe(
  debounceTime(300),
  map((event) => event.target.value),
  switchMap((query) => fetchResults(query)) // Cancel previous fetch
);

results.subscribe((data) => {
  displayResults(data);
});
```

Operators let you compose complex transformations on your data streams. Chain multiple operators together using `pipe()` to build sophisticated async workflows.

---

## When to Use Observables vs Signals

**Use Signals when:**

- You have simple state that changes occasionally
- You need derived/computed values
- The value is synchronous
- You're managing component or application state

**Use Observables when:**

- You're dealing with async operations
- You have streams of events over time
- You need complex transformations (debounce, retry, combine)
- The source is external (user events, websockets, timers)
- You need fine-grained control over subscriptions

**Combine them:**

```tsx
import { Component, signal, observable, toSignal } from "@kithinji/orca";

@Component()
export class LiveData {
  // Signal for user's selected filter
  filter = signal<"all" | "active" | "completed">("all");

  // Observable that fetches data
  data$ = observable<any>((observer) => {
    const currentFilter = this.filter.value;

    fetch(`/api/data?filter=${currentFilter}`)
      .then((res) => res.json())
      .then((data) => {
        observer.next(data);
        observer.complete();
      })
      .catch((err) => observer.error(err));
  });

  build() {
    const data = toSignal(this.data$, this);

    return (
      <div>
        <select
          value={this.filter.value}
          onChange={(e) => (this.filter.value = e.target.value)}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </select>

        <div>Data: {JSON.stringify(data)}</div>
      </div>
    );
  }
}
```

---

## Error Handling

Observables can emit errors, and you should handle them:

```typescript
const data = observable<string>((observer) => {
  fetch("/api/data")
    .then((res) => res.json())
    .then((data) => observer.next(data))
    .catch((err) => observer.error(err)); // Important!
});

data.subscribe({
  next: (value) => console.log("Success:", value),
  error: (err) => console.error("Failed:", err),
  complete: () => console.log("Done"),
});
```

In components, handle errors by using separate signals:

```tsx
import { Component, observable, signal, toSignal } from "@kithinji/orca";

@Component()
export class DataFetcher {
  data$ = observable<any>((observer) => {
    fetch("/api/data")
      .then((res) => res.json())
      .then((data) => {
        observer.next(data);
        observer.complete();
      })
      .catch((err) => observer.error(err));
  });

  error = signal<Error | null>(null);

  constructor() {
    this.data$.subscribe({
      error: (err) => (this.error.value = err),
    });
  }

  build() {
    if (this.error.value) {
      return <div>Error: {this.error.value.message}</div>;
    }

    const data = toSignal(this.data$, this);

    return <div>Data: {JSON.stringify(data)}</div>;
  }
}
```

---

## Real-World Examples

### Autocomplete Search

```typescript
import {
  fromEvent,
  debounceTime,
  map,
  switchMap,
  catchError,
  of,
} from "@kithinji/orca";

@Component()
export class SearchBox {
  results = signal<any[]>([]);

  constructor() {
    const input = document.querySelector("#search");

    fromEvent(input, "input")
      .pipe(
        debounceTime(300),
        map((event) => event.target.value),
        switchMap((query) =>
          fetch(`/api/search?q=${query}`)
            .then((res) => res.json())
            .catch((err) => of([]))
        )
      )
      .subscribe((results) => {
        this.results.value = results;
      });
  }

  build() {
    return (
      <div>
        <input id="search" placeholder="Search..." />
        <ul>
          {this.results.value.map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      </div>
    );
  }
}
```

### Retry Logic with Exponential Backoff

```typescript
import {
  observable,
  timer,
  switchMap,
  catchError,
  retry,
} from "@kithinji/orca";

const dataWithRetry = observable((observer) => {
  fetch("/api/data")
    .then((res) => res.json())
    .then((data) => {
      observer.next(data);
      observer.complete();
    })
    .catch((err) => observer.error(err));
}).pipe(
  retry({
    count: 3,
    delay: (error, retryCount) => timer(Math.pow(2, retryCount) * 1000),
  })
);
```

---

## Best Practices

1. **Always unsubscribe**: Prevent memory leaks by cleaning up subscriptions
2. **Use toSignal() in components**: Automatically handles subscription lifecycle
3. **Handle errors**: Always provide error handlers in your subscriptions
4. **Keep observables pure**: Avoid side effects in observable creation functions
5. **Name observable variables with $**: Convention to identify observables (e.g., `data$`)
6. **Use operators for transformations**: Don't manually subscribe and emit to new observables

---

## The Bottom Line

Observables are for streams of values over time.

**Lazy**: Only run when subscribed.

**Composable**: Chain transformations with operators.

**Cancellable**: Unsubscribe to stop execution.

**Powerful**: Handle complex async patterns with ease.

Signals and observables aren't competing—they're complementary. Use signals for state, observables for streams, and combine them with `toSignal()` to build reactive UIs that handle complexity gracefully.
