# The Event System: Bridging the Client–Server Divide

I've said repeatedly that the line between frontend and backend is arbitrary. That we should stop treating them as separate applications. That the distinction is mostly theater.

That's the sales pitch. And it's good marketing.

But the reality is: **The client–server boundary is real.** It's a network boundary. It's a fundamental difference in execution context. Pretending otherwise just means you're rebuilding REST APIs by hand and calling it innovation.

---

## How to Actually Think About Distributed Systems

Your application isn't a monolith. It's multiple actors communicating asynchronously.

- A component updates state
- Another component reacts to that change
- The client sends a message to the server
- The server processes it and responds - eventually
- Meanwhile, everything else continues running

This isn't procedural programming. It's **event-driven communication**.

To build systems that feel unified without lying about the boundaries, you need abstractions that make communication natural at every level - from state changes within a component to messages across the network.

That's what Orca's event system provides.

---

## Communication Primitives

Orca provides primitives for different types of communication:

**Signals** - communication within an execution context (local reactive state)

**Observables** - communication across time and boundaries (async streams)

**Actor Model** - communication between distributed actors (client-server, microservices)

Each builds on the same principle: **declare relationships, let the system handle coordination**.

---

## Signals: Local Communication

Signals represent reactive state within a single execution context.

They hold a value. When that value changes, anything depending on it updates automatically.

### Basic Example

```ts
"use client";
import { Component, signal } from "@kithinji/orca";

@Component()
export class Counter {
  private count = signal(0);

  build() {
    return (
      <div>
        <p>Count: {this.count.value}</p>
        <button onClick={() => (this.count.value += 1)}>Increment</button>
      </div>
    );
  }
}
```

### What's Happening

- `signal(0)` creates reactive state
- Reading `this.count.value` gets the current value
- Setting `this.count.value += 1` updates it
- Orca re-renders only the parts that depend on it

### Why Signals

Signals enable **fine-grained reactivity** within a component.

Instead of re-running entire components, only the exact DOM nodes depending on a signal update.

Benefits:

- Better performance by default
- Less boilerplate
- Predictable, synchronous updates
- Communication between parts of your UI without explicit wiring

Signals are for communication within a single execution context - typically client-side state.

---

## Observables: Communication Across Time

Observables model **streams of values over time**.

They work both within a single context (client-side events) and across boundaries (server-to-client streams).

### Client-Side Example

```ts
"use client";
import { Component, signal, observable } from "@kithinji/orca";

@Component()
export class SearchBox {
  private results = signal<string[]>([]);

  build() {
    const handleSearch = (query: string) => {
      const search$ = observable<string[]>((observer) => {
        fetch(`/api/search?q=${query}`)
          .then((res) => res.json())
          .then((data) => {
            observer.next(data);
            observer.complete();
          })
          .catch((err) => observer.error(err));
      });

      search$.subscribe((data) => {
        this.results.value = data;
      });
    };

    return (
      <div>
        <input onInput={(e) => handleSearch(e.target.value)} />
        <ul>
          {this.results.value.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }
}
```

### Cross-Boundary Example

Observables can also represent streams from the server:

```ts
"use public";

import { Injectable, observable, Observable } from "@kithinji/orca";

@Injectable()
export class TickService {
  // This observable streams from server to client
  public ticks(): Observable<number> {
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

```ts
"use client";

import { Component, toSignal } from "@kithinji/orca";

@Component()
export class TickDisplay {
  constructor(private tickService: TickService) {}

  build() {
    const ticks = toSignal(this.tickService.ticks(), this);
    return <div>Ticks: {ticks}</div>;
  }
}
```

The network boundary is there, but it's abstracted. The client subscribes to a stream. The server pushes values. It just works.

### Why Observables

Observables are ideal for:

- API calls
- Timers and intervals
- WebSockets and streaming
- User input streams
- Any async operation that produces multiple values

They're more powerful than Promises because they can emit multiple values, be cancelled, and be composed with operators.

**Key insight**: Observables work the same way whether the source is local (a timer, a DOM event) or remote (a server stream). The communication pattern is unified.

---

## Actor Model: Communication Across Boundaries

At the foundation is the Actor Model - a unified way to communicate between any two entities in your system.

Every entity is an actor:

- Each client is an actor
- The server is an actor
- Microservices are actors

They all communicate through the same interface, regardless of whether they're in the same process or across the network.

### Server-Side Actor

```ts
import { Controller, Subscribe, Message, Actor } from "@kithinji/orca";

@Controller()
export class AppController {
  constructor(private readonly actor: Actor) {}

  @Subscribe("ping")
  ping(msg: Message) {
    this.actor.send(msg.from, {
      event: "pong",
      data: "pong",
    });
  }
}
```

### Client-Side Actor

```ts
"use client";

import { Component, signal, Message, Actor } from "@kithinji/orca";

@Component()
export class AppComponent {
  constructor(private readonly actor: Actor) {
    this.actor.send("server", {
      event: "ping",
      data: "ping",
    });
  }

  build() {
    const pong = signal("");

    this.actor.subscribe("pong", (msg: Message) => {
      pong.value = msg.data;
    });

    return <div>{pong.value}</div>;
  }
}
```

### What's Happening

- The client sends a message to "server"
- The server receives it, handles it, responds
- The client receives the response
- All using the same Actor interface

The transport mechanism (WebSockets, HTTP, whatever) is abstracted away. A browser can send a message to a microservice. Routing happens transparently.

---

## How They Work Together

These primitives form a coherent system:

### Signals -> Observables

```ts
const query = signal("");

fromEvent(input, "input")
  .pipe(
    map((e) => e.target.value),
    debounceTime(300)
  )
  .subscribe((value) => {
    query.value = value; // Observable feeds signal
  });
```

### Observables -> Signals

```ts
const data$ = observable<Data>((observer) => {
  // async work
});

const data = toSignal(data$, this); // Convert stream to reactive state
```

### Actors -> Observables

```ts
// Server publishes an observable stream
public updates(): Observable<Update> {
  return observable((observer) => {
    // stream updates to client
  });
}
```

### Actors -> Signals

```ts
const status = signal("disconnected");

actor.subscribe("status", (msg) => {
  status.value = msg.data; // Actor message updates signal
});
```

The boundaries blur, but they don't disappear. Communication is unified at every level.

---

## Communication, Not Control Flow

Traditional code is about control flow:

```ts
async function handleClick() {
  setLoading(true);
  try {
    const data = await fetch("/api/data");
    setResult(data);
  } catch (error) {
    setError(error);
  } finally {
    setLoading(false);
  }
}
```

You manage every transition explicitly.

Event-driven code is about communication:

```ts
const data$ = fetchData();
const loading = signal(true);
const result = signal(null);

data$.subscribe({
  next: (data) => {
    result.value = data;
    loading.value = false;
  },
  error: (err) => {
    loading.value = false;
  },
});
```

You declare relationships. The system handles coordination.

This is what makes Orca's "unified codebase" work: **communication patterns that scale from local state to distributed systems**.

---

## When to Use What

### Use Signals When

- You need local reactive state
- Values update synchronously
- You want fine-grained reactivity
- Communication is within a component or module

### Use Observables When

- You're dealing with async operations
- Values arrive over time
- You need transformation operators (debounce, retry, etc.)
- Communication crosses time or potentially crosses boundaries

### Use Actors When

- You need explicit bidirectional communication
- You're coordinating between client and server
- You're building distributed systems patterns
- You need message-based architecture

Often, you'll use all of them together.

---

## What Comes Next

This chapter lays the foundation for understanding communication in Orca.

**In the Signals chapter:**

- Creating and updating signals
- Computed signals and derivation
- Effects and side effect management
- Composition patterns

**In the Observables chapter:**

- Creating observables from various sources
- Operators for transformation
- Error handling strategies
- Subscription lifecycle management
- Real-world async patterns
- Cross-boundary streaming

**The Actor Model:**

- When it's ready for production, we'll explore distributed communication patterns in depth

---

## Final Thoughts

The client–server boundary exists. Ignoring it creates worse architecture, not better.

The event system makes that boundary manageable by providing **unified communication primitives** at every scale.

Signals for local state. Observables for async streams. Actors for distributed messages.

You're not orchestrating control flow.  
You're declaring communication patterns.

That's the illusion Orca offers.  
And the event system is how it holds together.
