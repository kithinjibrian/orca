# How Orca Compiles JSX

Orca compiles JSX twice - once for the server, once for the client. Each compilation targets the specific constraints and opportunities of its environment.

## Server: Objects Over HTML

Server-side JSX compiles to JavaScript objects, not HTML strings:

```tsx
<div>Hello, World</div>
```

```json
{
  "$$typeof": "orca:element",
  "id": "00000000-0000-0000-0000-000000000000",
  "type": "div",
  "props": {
    "children": "Hello, World"
  },
  "key": null
}
```

Why objects? Because Orca needs to stream partial UI before the full component tree is ready. Objects can reference things that don't exist yet. HTML can't.

## Async Without Blocking

Here's the problem most frameworks face: when you hit an async component during server rendering, you either wait for it (slow) or introduce complexity with Suspense boundaries (messy).

Orca doesn't wait. When it encounters an async component, it inserts a placeholder reference and keeps going. The async component resolves independently and gets sent to the client when ready.

```tsx
@Component()
class ReadUsers {
  async build() {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return <li>users</li>;
  }
}

@Component()
class Show {
  build() {
    return (
      <div>
        <h1>Friends</h1>
        <ReadUsers />
      </div>
    );
  }
}
```

Rendering `Show` produces two streams:

**First (immediately):**

```json
{
  "$$typeof": "orca:element",
  "id": "00000000-0000-0000-0000-000000000000",
  "type": "div",
  "action": "insert",
  "props": {
    "children": [
      {
        "$$typeof": "orca:element",
        "id": "00000000-0000-0000-0000-000000000001",
        "type": "h1",
        "props": { "children": "Friends" },
        "key": null
      },
      {
        "$$typeof": "orca:pending_reference",
        "id": "00000000-0000-0000-0000-000000000002",
        "type": "ref",
        "props": {},
        "key": null
      }
    ]
  },
  "key": null
}
```

**Second (after 1s):**

```json
{
  "$$typeof": "orca:element",
  "id": "00000000-0000-0000-0000-000000000002",
  "type": "li",
  "action": "update",
  "props": { "children": "users" },
  "key": null
}
```

The client gets instructions via the `action` field: `insert` for new content, `update` to swap a reference. No diffing needed - the server tells the client exactly what to do.

This scales. You can nest async components arbitrarily deep, and they'll resolve in whatever order they complete. No cascading waterfalls.

## Client: Direct DOM Manipulation

Client-side compilation produces imperative DOM code. No virtual DOM.

```tsx
@Component()
class Counter {
  num = signal(0);

  build() {
    return (
      <div>
        <h1>Count: {this.num.value}</h1>
        <button onClick={() => this.num.value++}>increment</button>
      </div>
    );
  }
}
```

```js
var Counter = class {
  num = signal(0);

  build() {
    const self = this;
    return (() => {
      var _el = document.createElement("div");
      var _el2 = document.createElement("h1");
      insert(_el2, "Count:");
      insert(_el2, this.num);
      insert(_el, _el2);
      var _el3 = document.createElement("button");
      _el3.addEventListener("click", () => self.num.value++);
      insert(_el3, "increment");
      insert(_el, _el3);
      return _el;
    })();
  }
};
```

Each JSX tag becomes `createElement`, properties become direct assignments, children become `insert` calls.

## Reactivity

When you pass `this.num` to `insert`, it doesn't just read the current value. Signals track their dependents, so when `this.num` changes, only the specific text node updates. No component re-render.

Passing signals to child components requires preserving reactivity:

```tsx
@Component()
class Comp {
  width = signal(100);

  build() {
    return <Card width={this.width.value} />;
  }
}
```

```js
var Comp = class {
  width = signal(100);

  build() {
    const self = this;
    return (() => {
      var _el = createComponent(
        Card,
        {
          get width() {
            return self.width.value;
          },
        },
        self
      );
      return _el;
    })();
  }
};
```

The getter wrapper ensures `Card` receives a reactive binding. If `width` changes, effects inside `Card` re-run automatically.

Orca also supports `BehaviorSubject`, converting them to signals under the hood:

```tsx
@Component()
class Comp {
  data = new BehaviorSubject(100);

  build() {
    return <h1>data: {this.data.$value}</h1>;
  }
}
```

```js
var Comp = class {
  data = new BehaviorSubject(100);

  build() {
    const self = this;
    const _sig = toSignal(self.data, self);
    return (() => {
      var _el = document.createElement("h1");
      insert(_el, "data:");
      insert(_el, _sig);
      return _el;
    })();
  }
};
```

`toSignal` adapts observables to signal model, giving you interoperability without breaking reactivity.

## Why Two Targets

Server and client have different constraints. The server needs to stream partial content without blocking. The client needs minimal runtime overhead and surgical DOM updates.

Most frameworks pick one approach and compromise on the other. Orca compiles twice and compromises on neither. You write components with `async` and `signal`, and get streaming SSR plus fine-grained reactivity for free.
